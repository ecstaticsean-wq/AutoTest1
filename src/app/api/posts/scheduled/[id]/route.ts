import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { cancelScheduledMessage } from "@/lib/qstash";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const post = await db.post.findUnique({ where: { id } });
  if (!post || post.userId !== session.userId || post.status !== "SCHEDULED") {
    return NextResponse.json({ error: "예약된 글을 찾을 수 없습니다" }, { status: 404 });
  }

  if (post.qstashMessageId) {
    await cancelScheduledMessage(post.qstashMessageId).catch((err) => {
      console.error("[scheduled-delete] cancel message failed", err);
    });
  }

  await db.post.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
