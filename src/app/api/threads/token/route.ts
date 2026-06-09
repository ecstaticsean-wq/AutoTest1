import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await db.threadsToken.findUnique({
    where: { userId: session.userId },
    select: { threadsUserId: true, tokenExpiresAt: true, updatedAt: true },
  });

  if (!token) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    threadsUserId: token.threadsUserId,
    expiresAt: token.tokenExpiresAt,
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.threadsToken
    .delete({ where: { userId: session.userId } })
    .catch(() => null);

  return NextResponse.json({ success: true });
}
