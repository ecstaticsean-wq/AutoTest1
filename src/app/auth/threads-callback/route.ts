import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getThreadsProfile,
} from "@/lib/threads-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/settings?error=threads_auth_failed", req.nextUrl)
    );
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? req.nextUrl.origin;
    const redirectUri = `${baseUrl}/auth/threads-callback`;

    const shortToken = await exchangeCodeForToken(code, redirectUri);
    const longToken = await exchangeForLongLivedToken(shortToken.access_token);
    const profile = await getThreadsProfile(longToken.access_token);

    const tokenExpiresAt = new Date(
      Date.now() + longToken.expires_in * 1000
    );

    await db.threadsToken.upsert({
      where: { userId: session.userId },
      update: {
        threadsUserId: profile.id,
        accessToken: longToken.access_token,
        tokenExpiresAt,
      },
      create: {
        userId: session.userId,
        threadsUserId: profile.id,
        accessToken: longToken.access_token,
        tokenExpiresAt,
      },
    });

    return NextResponse.redirect(
      new URL("/settings?connected=threads", req.nextUrl)
    );
  } catch (err) {
    console.error("[threads-callback]", err);
    return NextResponse.redirect(
      new URL("/settings?error=threads_token_exchange_failed", req.nextUrl)
    );
  }
}
