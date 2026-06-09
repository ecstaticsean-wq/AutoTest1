import "server-only";
import { Client } from "@upstash/qstash";

let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) throw new Error("QSTASH_TOKEN 환경변수가 설정되지 않았습니다");
    _client = new Client({ token });
  }
  return _client;
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

// Schedule comment polling: every 1 min × 10 times (= 10-minute window)
export async function schedulePollReplies(postId: string, publishedAt: Date) {
  const client = getClient();
  const baseUrl = getBaseUrl();

  for (let i = 1; i <= 10; i++) {
    const delaySeconds = i * 60;
    await client.publishJSON({
      url: `${baseUrl}/api/jobs/poll-replies`,
      delay: delaySeconds,
      body: { postId, checkNumber: i },
    });
  }
}

// Schedule analytics snapshots at +1d, +3d, +7d, +30d
export async function scheduleAnalyticsSnapshots(postId: string, publishedAt: Date) {
  const client = getClient();
  const baseUrl = getBaseUrl();
  const publishedMs = publishedAt.getTime();

  const schedule = [
    { period: "DAY_1", delayMs: 1 * 24 * 60 * 60 * 1000 },
    { period: "DAY_3", delayMs: 3 * 24 * 60 * 60 * 1000 },
    { period: "DAY_7", delayMs: 7 * 24 * 60 * 60 * 1000 },
    { period: "DAY_30", delayMs: 30 * 24 * 60 * 60 * 1000 },
  ];

  for (const { period, delayMs } of schedule) {
    const nowMs = Date.now();
    const fireAt = publishedMs + delayMs;
    const delaySecs = Math.max(1, Math.round((fireAt - nowMs) / 1000));

    await client.publishJSON({
      url: `${baseUrl}/api/jobs/snapshot`,
      delay: delaySecs,
      body: { postId, period },
    });
  }
}
