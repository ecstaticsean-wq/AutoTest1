export const DAILY_FREE_LIMIT = 20;

const STORAGE_KEY = "promo-ai-daily-usage";

interface DailyUsage {
  date: string; // YYYY-MM-DD, local date
  count: number;
}

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readUsage(): DailyUsage {
  if (typeof window === "undefined") return { date: todayKey(), count: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as DailyUsage;
    if (parsed.date !== todayKey() || typeof parsed.count !== "number") {
      return { date: todayKey(), count: 0 };
    }
    return parsed;
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function writeUsage(usage: DailyUsage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // localStorage unavailable (private mode, storage full, etc.) — usage tracking is best-effort only
  }
}

export function getRemainingQuota(): number {
  return Math.max(0, DAILY_FREE_LIMIT - readUsage().count);
}

export function recordUsage(): void {
  const usage = readUsage();
  writeUsage({ date: usage.date, count: usage.count + 1 });
}
