import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { scheduleAutoPublish } from "@/lib/qstash";

const ScheduleSchema = z.object({
  items: z
    .array(
      z.object({
        postText: z.string().min(1),
        productName: z.string().min(1),
        salesUrl: z.string().url(),
        postFormat: z.string().min(1),
      })
    )
    .min(1),
  startAt: z.string().datetime(),
  intervalMinutes: z.number().int().min(1).max(1440),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = ScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const { items, startAt, intervalMinutes } = parsed.data;

  const token = await db.threadsToken.findUnique({
    where: { userId: session.userId },
  });

  if (!token) {
    return NextResponse.json(
      { error: "Threads 계정이 연결되어 있지 않습니다. 설정에서 연결해주세요." },
      { status: 400 }
    );
  }

  const startMs = new Date(startAt).getTime();

  const scheduled = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const scheduledAt = new Date(startMs + i * intervalMinutes * 60_000);

    const post = await db.post.create({
      data: {
        userId: session.userId,
        productName: item.productName,
        salesUrl: item.salesUrl,
        generatedText: item.postText.slice(0, 500),
        postFormat: item.postFormat,
        status: "SCHEDULED",
        scheduledAt,
      },
    });

    const messageId = await scheduleAutoPublish(post.id, scheduledAt);

    await db.post.update({
      where: { id: post.id },
      data: { qstashMessageId: messageId },
    });

    scheduled.push({ postId: post.id, scheduledAt });
  }

  return NextResponse.json({ success: true, scheduled });
}
