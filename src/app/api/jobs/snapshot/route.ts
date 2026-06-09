import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { db } from "@/lib/db";
import { getPostInsights } from "@/lib/threads-api";
import type { SnapshotPeriod } from "@prisma/client";

export const runtime = "nodejs";

const VALID_PERIODS: SnapshotPeriod[] = ["DAY_1", "DAY_3", "DAY_7", "DAY_30"];

function getReceiver(): Receiver {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentKey || !nextKey) throw new Error("QStash signing keys not set");
  return new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey });
}

export async function POST(req: NextRequest) {
  const receiver = getReceiver();
  const body = await req.text();
  const sig = req.headers.get("upstash-signature") ?? "";

  const isValid = await receiver
    .verify({ signature: sig, body })
    .catch(() => false);

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = JSON.parse(body) as { postId: string; period: string };
  const { postId, period } = payload;

  if (!VALID_PERIODS.includes(period as SnapshotPeriod)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const post = await db.post.findUnique({
    where: { id: postId },
    select: { threadsPostId: true, userId: true },
  });

  if (!post?.threadsPostId) {
    return NextResponse.json({ skipped: true, reason: "no_threads_post" });
  }

  const token = await db.threadsToken.findUnique({
    where: { userId: post.userId },
    select: { accessToken: true },
  });

  if (!token) {
    return NextResponse.json({ skipped: true, reason: "no_token" });
  }

  let insights;
  try {
    insights = await getPostInsights(post.threadsPostId, token.accessToken);
  } catch (err) {
    console.error("[snapshot] insights fetch failed", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }

  await db.analyticsSnapshot.upsert({
    where: { postId_snapshotPeriod: { postId, snapshotPeriod: period as SnapshotPeriod } },
    update: { ...insights, capturedAt: new Date() },
    create: {
      postId,
      snapshotPeriod: period as SnapshotPeriod,
      ...insights,
    },
  });

  return NextResponse.json({ success: true, period, insights });
}
