import { NextRequest, NextResponse } from "next/server";
import { getReceiver } from "@/lib/qstash";
import { executePublish, PublishError } from "@/lib/publish-post";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const { postId } = JSON.parse(body) as { postId: string };

  try {
    await executePublish(postId);
  } catch (err) {
    console.error("[auto-publish] failed", err);
    if (err instanceof PublishError) {
      // Already marked FAILED in DB; ack so QStash doesn't retry and double-post.
      return NextResponse.json({ ok: false, error: err.message });
    }
    return NextResponse.json({ error: "발행 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
