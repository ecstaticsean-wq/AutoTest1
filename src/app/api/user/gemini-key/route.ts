import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/encryption";

const SaveKeySchema = z.object({
  apiKey: z.string().min(10, { error: "올바른 API 키를 입력해주세요" }),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SaveKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors.apiKey?.[0] },
      { status: 400 }
    );
  }

  const encryptedApiKey = encrypt(parsed.data.apiKey);

  await db.userGeminiKey.upsert({
    where: { userId: session.userId },
    update: { encryptedApiKey },
    create: { userId: session.userId, encryptedApiKey },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.userGeminiKey
    .delete({ where: { userId: session.userId } })
    .catch(() => null); // already deleted

  return NextResponse.json({ success: true });
}
