export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "@/actions/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-white font-bold text-lg">
              딸깍 쓰레드
            </Link>
            <Link
              href="/dashboard"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              글 생성
            </Link>
            <Link
              href="/posts"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              게시 이력
            </Link>
            <Link
              href="/settings"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              설정
            </Link>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              로그아웃
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
