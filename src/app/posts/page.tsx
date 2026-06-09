export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export default async function PostsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const posts = await db.post.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { snapshots: true, replies: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">게시 이력</h1>
        <p className="text-slate-400 mt-1">게시한 Threads 포스트와 성과를 확인하세요</p>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white/10 border border-white/20 rounded-2xl p-12 text-center">
          <p className="text-slate-400">아직 게시된 포스트가 없습니다</p>
          <a
            href="/dashboard"
            className="mt-4 inline-block text-purple-400 hover:text-purple-300 text-sm"
          >
            글 생성하러 가기 →
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white/10 border border-white/20 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium">
                      {post.postFormat}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-white font-medium truncate">{post.productName}</p>
                  <p className="text-slate-400 text-sm mt-1 line-clamp-2">{post.generatedText}</p>
                </div>

                <div className="flex-shrink-0 text-right">
                  {post.publishedAt ? (
                    <span className="inline-block px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                      게시됨
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-1 bg-slate-600/40 text-slate-400 text-xs rounded-full">
                      미게시
                    </span>
                  )}
                </div>
              </div>

              {post.snapshots.length > 0 && (
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {[
                    { label: "도달", key: "reach" },
                    { label: "노출", key: "impressions" },
                    { label: "댓글", key: "replies" },
                    { label: "리포스트", key: "reposts" },
                    { label: "좋아요", key: "likes" },
                  ].map(({ label, key }) => {
                    const latest = post.snapshots[post.snapshots.length - 1];
                    const value = (latest as unknown as Record<string, number | null>)[key] ?? 0;
                    return (
                      <div key={key} className="text-center">
                        <div className="text-white font-semibold text-sm">{value}</div>
                        <div className="text-slate-500 text-xs">{label}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
