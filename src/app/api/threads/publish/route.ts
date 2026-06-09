import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  createTextContainer,
  publishContainer,
} from "@/lib/threads-api";
import {
  schedulePollReplies,
  scheduleAnalyticsSnapshots,
} from "@/lib/qstash";

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

  const { postText, productName, salesUrl, postFormat } = parsed.data;

  const token = await db.threadsToken.findUnique({
    where: { userId: session.userId },
  });

  if (!token) {
    return NextResponse.json(
      { error: "Threads 계정이 연결되어 있지 않습니다. 설정에서 연결해주세요." },
      { status: 400 }
    );
  }

  // Step 1: create container
  let containerId: string;
  try {
    const container = await createTextContainer(
      token.threadsUserId,
      postText,
      token.accessToken
    );
    containerId = container.id;
  } catch (err) {
    console.error("[publish] container creation failed", err);
    return NextResponse.json({ error: "Threads 글 생성 실패" }, { status: 502 });
  }

  // Step 2: 30-second wait (Meta requirement)
  await new Promise((r) => setTimeout(r, 30_000));

  // Step 3: publish
  let threadsPostId: string;
  try {
    const result = await publishContainer(
      token.threadsUserId,
      containerId,
      token.accessToken
    );
    threadsPostId = result.id;
  } catch (err) {
    console.error("[publish] publish failed", err);
    return NextResponse.json({ error: "Threads 게시 실패" }, { status: 502 });
  }

  const publishedAt = new Date();
  const replyWindowEnds = new Date(publishedAt.getTime() + 10 * 60 * 1000);

  // Save to DB
  const post = await db.post.create({
    data: {
      userId: session.userId,
      productName,
      salesUrl,
      generatedText: postText,
      postFormat,
      threadsPostId,
      publishedAt,
      replyWindowEnds,
      replyJobStatus: "ACTIVE",
    },
  });

  // Schedule background jobs (best-effort: don't fail publish if QStash unavailable)
  try {
    await Promise.all([
      schedulePollReplies(post.id, publishedAt),
      scheduleAnalyticsSnapshots(post.id, publishedAt),
    ]);
  } catch (err) {
    console.error("[publish] QStash scheduling failed", err);
  }

  return NextResponse.json({ success: true, postId: post.id, threadsPostId });
}
