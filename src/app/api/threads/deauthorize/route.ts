import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Meta calls this when a user removes the app's access to their Threads account.
export async function POST() {
  return NextResponse.json({ success: true });
}
