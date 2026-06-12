import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { executePublish, PublishError } from "@/lib/publish-post";

export const maxDuration = 60;

const PublishSchema = z.object({
  postText: z.string().min(1),
  productName: z.string().min(1),
  salesUrl: z.string().url(),
  postFormat: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = PublishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "입력 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const { productName, salesUrl, postFormat } = parsed.data;
  const postText = parsed.data.postText.slice(0, 500);

  const token = await db.threadsToken.findUnique({
    where: { userId: session.userId },
  });

  if (!token) {
    return NextResponse.json(
      { error: "Threads 계정이 연결되어 있지 않습니다. 설정에서 연결해주세요." },
      { status: 400 }
    );
  }

  const post = await db.post.create({
    data: {
      userId: session.userId,
      productName,
      salesUrl,
      generatedText: postText,
      postFormat,
      status: "SCHEDULED",
    },
  });

  try {
    await executePublish(post.id);
  } catch (err) {
    const message = err instanceof PublishError ? err.message : "Threads 게시 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ success: true, postId: post.id });
}
