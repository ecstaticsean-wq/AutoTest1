import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { db } from "@/lib/db";
import { getPostReplies, replyToComment } from "@/lib/threads-api";
import { getGeminiForUser } from "@/lib/gemini-for-user";
import { GEMINI_MODEL } from "@/lib/gemini";
import { ApiError } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

function getReceiver(): Receiver {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentKey || !nextKey) {
    throw new Error("QStash signing keys not set");
  }
  return new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
}

export async function POST(req: NextRequest) {
  // Verify QStash signature
  const receiver = getReceiver();
  const body = await req.text();
  const sig = req.headers.get("upstash-signature") ?? "";

  const isValid = await receiver
    .verify({ signature: sig, body })
    .catch(() => false);

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { postId: string; checkNumber: number };
  const { postId } = payload;

  const post = await db.post.findUnique({
    where: { id: postId },
    include: { user: true },
  });

  if (!post || !post.threadsPostId || post.replyJobStatus === "DONE") {
    return NextResponse.json({ skipped: true });
  }

  const token = await db.threadsToken.findUnique({
    where: { userId: post.userId },
  });

  if (!token) {
    return NextResponse.json({ skipped: true, reason: "no_token" });
  }

  // Check if reply window has passed
  const now = new Date();
  if (post.replyWindowEnds && now > post.replyWindowEnds) {
    await db.post.update({
      where: { id: postId },
      data: { replyJobStatus: "DONE" },
    });
    return NextResponse.json({ done: true, reason: "window_expired" });
  }

  let comments;
  try {
    comments = await getPostReplies(post.threadsPostId, token.accessToken);
  } catch (err) {
    console.error("[poll-replies] failed to fetch replies", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }

  const alreadyTracked = await db.replyTracking.findMany({
    where: { postId },
    select: { threadsCommentId: true },
  });
  const trackedIds = new Set(alreadyTracked.map((r) => r.threadsCommentId));
  const newComments = comments.filter((c) => !trackedIds.has(c.id));

  if (newComments.length === 0) {
    return NextResponse.json({ checked: true, newReplies: 0 });
  }

  // Create tracking rows
  await db.replyTracking.createMany({
    data: newComments.map((c) => ({
      postId,
      threadsCommentId: c.id,
      commentText: c.text,
      status: "PENDING" as const,
    })),
    skipDuplicates: true,
  });

  // Generate and send auto-replies
  let geminiAi;
  try {
    geminiAi = await getGeminiForUser(post.userId);
  } catch {
    return NextResponse.json({ tracked: newComments.length, replied: 0 });
  }

  let repliedCount = 0;
  for (const comment of newComments) {
    try {
      const prompt = [
        "당신은 Threads에서 제품 홍보 중인 계정의 운영자입니다.",
        `게시글 주제: ${post.productName} (${post.salesUrl})`,
        `달린 댓글: "${comment.text}"`,
        "",
        "위 댓글에 대해 자연스럽고 친근한 한국어 답글을 작성해주세요.",
        "규칙: 반말체, 3문장 이내, 댓글 내용에 직접 반응, 과도한 홍보 문구 없이 소통에 집중",
        "답글 텍스트만 출력하세요. 따옴표나 설명 없이.",
      ].join("\n");

      let replyText = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await geminiAi.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          });
          replyText = res.text?.trim() ?? "";
          if (replyText) break;
        } catch (err) {
          if (err instanceof ApiError && err.status === 503 && attempt < 1) {
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            throw err;
          }
        }
      }

      if (!replyText) continue;

      await replyToComment(token.threadsUserId, replyText, comment.id, token.accessToken);

      await db.replyTracking.update({
        where: { threadsCommentId: comment.id },
        data: { replyText, repliedAt: new Date(), status: "REPLIED" },
      });

      repliedCount++;
    } catch (err) {
      console.error("[poll-replies] reply failed for comment", comment.id, err);
      await db.replyTracking
        .update({
          where: { threadsCommentId: comment.id },
          data: { status: "FAILED" },
        })
        .catch(() => null);
    }
  }

  return NextResponse.json({ tracked: newComments.length, replied: repliedCount });
}
