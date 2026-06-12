"use client";

import { useState } from "react";

export type ScheduledPost = {
  id: string;
  productName: string;
  generatedText: string;
  postFormat: string;
  scheduledAt: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScheduledPosts({ posts: initialPosts }: { posts: ScheduledPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  if (posts.length === 0) return null;

  async function cancel(id: string) {
    if (!confirm("이 예약을 취소하시겠습니까?")) return;

    setCancelingId(id);
    try {
      const res = await fetch(`/api/posts/scheduled/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        const data = await res.json();
        alert(`취소 실패: ${data.error}`);
      }
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-6">
      <h2 className="text-white font-semibold text-lg mb-1">예약된 글 ({posts.length}개)</h2>
      <p className="text-slate-400 text-sm mb-4">예정된 시간에 자동으로 Threads에 발행됩니다</p>

      <div className="space-y-3">
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-black/20 rounded-xl p-4 flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                  {post.postFormat}
                </span>
                <span className="text-white text-sm font-medium">{post.productName}</span>
              </div>
              <p className="text-slate-300 text-xs mb-1">{formatDateTime(post.scheduledAt)} 발행 예정</p>
              <p className="text-slate-500 text-xs truncate">{post.generatedText}</p>
            </div>
            <button
              onClick={() => cancel(post.id)}
              disabled={cancelingId === post.id}
              className="flex-shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-300 text-xs font-semibold rounded-lg transition-colors"
            >
              {cancelingId === post.id ? "취소 중…" : "취소"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
