import "server-only";

const THREADS_BASE = "https://graph.threads.net";
const THREADS_AUTH_BASE = "https://threads.net/oauth";

export type ThreadsTokenResponse = {
  access_token: string;
  user_id: string;
};

export type ThreadsLongLivedTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type ThreadsUserProfile = {
  id: string;
  name: string;
  username: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
};

// ── OAuth ────────────────────────────────────────────────────────────────────

export function buildOAuthUrl(redirectUri: string): string {
  const appId = process.env.THREADS_APP_ID;
  if (!appId) throw new Error("THREADS_APP_ID 환경변수가 설정되지 않았습니다");

  const scopes = [
    "threads_basic",
    "threads_content_publish",
    "threads_manage_insights",
    "threads_manage_replies",
    "threads_read_replies",
  ].join(",");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: "code",
  });

  return `${THREADS_AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<ThreadsTokenResponse> {
  const appId = process.env.THREADS_APP_ID!;
  const appSecret = process.env.THREADS_APP_SECRET!;

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${THREADS_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads 토큰 교환 실패: ${err}`);
  }

  return res.json() as Promise<ThreadsTokenResponse>;
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<ThreadsLongLivedTokenResponse> {
  const appSecret = process.env.THREADS_APP_SECRET!;

  const params = new URLSearchParams({
    grant_type: "th_exchange_token",
    client_secret: appSecret,
    access_token: shortLivedToken,
  });

  const res = await fetch(
    `${THREADS_BASE}/access_token?${params.toString()}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads 장기토큰 교환 실패: ${err}`);
  }

  return res.json() as Promise<ThreadsLongLivedTokenResponse>;
}

export async function refreshLongLivedToken(
  accessToken: string
): Promise<ThreadsLongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "th_refresh_token",
    access_token: accessToken,
  });

  const res = await fetch(
    `${THREADS_BASE}/refresh_access_token?${params.toString()}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads 토큰 갱신 실패: ${err}`);
  }

  return res.json() as Promise<ThreadsLongLivedTokenResponse>;
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getThreadsProfile(
  accessToken: string
): Promise<ThreadsUserProfile> {
  const params = new URLSearchParams({
    fields: "id,name,username,threads_profile_picture_url,threads_biography",
    access_token: accessToken,
  });

  const res = await fetch(`${THREADS_BASE}/me?${params.toString()}`);
  if (!res.ok) throw new Error("Threads 프로필 조회 실패");

  return res.json() as Promise<ThreadsUserProfile>;
}

// ── Publish ──────────────────────────────────────────────────────────────────

export type CreateContainerResult = { id: string };

export async function createTextContainer(
  threadsUserId: string,
  text: string,
  accessToken: string
): Promise<CreateContainerResult> {
  const params = new URLSearchParams({
    media_type: "TEXT",
    text,
    access_token: accessToken,
  });

  const res = await fetch(
    `${THREADS_BASE}/${threadsUserId}/threads?${params.toString()}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads 컨테이너 생성 실패: ${err}`);
  }

  return res.json() as Promise<CreateContainerResult>;
}

export async function publishContainer(
  threadsUserId: string,
  creationId: string,
  accessToken: string
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const res = await fetch(
    `${THREADS_BASE}/${threadsUserId}/threads_publish?${params.toString()}`,
    { method: "POST" }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads 게시 실패: ${err}`);
  }

  return res.json() as Promise<{ id: string }>;
}

// ── Comments ─────────────────────────────────────────────────────────────────

export type ThreadsComment = {
  id: string;
  text: string;
  username: string;
  timestamp: string;
};

export async function getPostReplies(
  postId: string,
  accessToken: string
): Promise<ThreadsComment[]> {
  const params = new URLSearchParams({
    fields: "id,text,username,timestamp",
    access_token: accessToken,
  });

  const res = await fetch(
    `${THREADS_BASE}/${postId}/replies?${params.toString()}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads 댓글 조회 실패: ${err}`);
  }

  const data = (await res.json()) as { data: ThreadsComment[] };
  return data.data ?? [];
}

export async function replyToComment(
  threadsUserId: string,
  text: string,
  replyToId: string,
  accessToken: string
): Promise<{ id: string }> {
  const createParams = new URLSearchParams({
    media_type: "TEXT",
    text,
    reply_to_id: replyToId,
    access_token: accessToken,
  });

  const createRes = await fetch(
    `${THREADS_BASE}/${threadsUserId}/threads?${createParams.toString()}`,
    { method: "POST" }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Threads 답글 컨테이너 생성 실패: ${err}`);
  }

  const { id: creationId } = (await createRes.json()) as { id: string };

  // 30초 대기 (Meta 권장)
  await new Promise((r) => setTimeout(r, 30_000));

  return publishContainer(threadsUserId, creationId, accessToken);
}

// ── Analytics ────────────────────────────────────────────────────────────────

export type ThreadsInsights = {
  reach: number;
  impressions: number;
  replies: number;
  reposts: number;
  likes: number;
};

export async function getPostInsights(
  postId: string,
  accessToken: string
): Promise<ThreadsInsights> {
  const params = new URLSearchParams({
    metric: "reach,impressions,replies,reposts,likes",
    access_token: accessToken,
  });

  const res = await fetch(
    `${THREADS_BASE}/${postId}/insights?${params.toString()}`
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Threads 인사이트 조회 실패: ${err}`);
  }

  const data = (await res.json()) as {
    data: { name: string; values: { value: number }[] }[];
  };

  const metrics: Record<string, number> = {};
  for (const item of data.data) {
    metrics[item.name] = item.values?.[0]?.value ?? 0;
  }

  return {
    reach: metrics.reach ?? 0,
    impressions: metrics.impressions ?? 0,
    replies: metrics.replies ?? 0,
    reposts: metrics.reposts ?? 0,
    likes: metrics.likes ?? 0,
  };
}
