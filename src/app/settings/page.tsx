export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { buildOAuthUrl } from "@/lib/threads-api";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user, threadsToken] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true, geminiKey: { select: { addedAt: true } } },
    }),
    db.threadsToken.findUnique({
      where: { userId: session.userId },
      select: { threadsUserId: true, tokenExpiresAt: true },
    }),
  ]);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const redirectUri = `${baseUrl}/auth/threads-callback`;

  let threadsOAuthUrl: string | null = null;
  try {
    threadsOAuthUrl = buildOAuthUrl(redirectUri);
  } catch {
    // THREADS_APP_ID not set yet — show disabled state
  }

  const { connected, error } = await searchParams;

  return (
    <SettingsClient
      user={{ name: user?.name ?? null, email: user?.email ?? "" }}
      threadsToken={
        threadsToken
          ? {
              threadsUserId: threadsToken.threadsUserId,
              expiresAt: threadsToken.tokenExpiresAt.toISOString(),
            }
          : null
      }
      hasGeminiKey={!!user?.geminiKey}
      threadsOAuthUrl={threadsOAuthUrl}
      successMsg={connected === "threads" ? "Threads 계정이 연결되었습니다!" : null}
      errorMsg={
        error === "threads_auth_failed"
          ? "Threads 인증이 취소되었습니다"
          : error === "threads_token_exchange_failed"
          ? "Threads 토큰 교환에 실패했습니다. 잠시 후 다시 시도해주세요"
          : null
      }
    />
  );
}
