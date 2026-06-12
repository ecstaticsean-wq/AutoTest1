import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Meta calls this when a user requests deletion of data shared with the app.
export async function POST() {
  const confirmationCode = `del_${Date.now()}`;
  return NextResponse.json({
    url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/threads/data-deletion?id=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
