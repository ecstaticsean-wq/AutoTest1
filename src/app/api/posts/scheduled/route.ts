import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const posts = await db.post.findMany({
    where: { userId: session.userId, status: "SCHEDULED" },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      productName: true,
      generatedText: true,
      postFormat: true,
      scheduledAt: true,
    },
  });

  return NextResponse.json({ posts });
}
