import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import ThreadsUploadFlow from "@/components/ThreadsUploadFlow";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { threadsToken: true, geminiKey: true },
  });

  const hasThreadsToken = !!user?.threadsToken;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          안녕하세요, {user?.name ?? "님"}
        </h1>
        <p className="text-slate-400 mt-1">
          제품 리스트를 업로드하고 Threads 소통형 글을 생성해보세요
        </p>
      </div>

      {(!hasThreadsToken || !user?.geminiKey) && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-300">
          <span className="font-semibold">시작 전 확인: </span>
          {!hasThreadsToken && (
            <>
              <a href="/settings" className="underline hover:text-yellow-200">
                Threads 계정을 연결
              </a>
              {!user?.geminiKey && "하고 "}
            </>
          )}
          {!user?.geminiKey && (
            <>
              <a href="/settings" className="underline hover:text-yellow-200">
                Gemini API 키를 등록
              </a>
              (선택, 무료 한도 초과 시)
            </>
          )}
          하면 더 원활하게 이용하실 수 있습니다.
        </div>
      )}

      <ThreadsUploadFlow hasThreadsToken={hasThreadsToken} />
    </div>
  );
}
