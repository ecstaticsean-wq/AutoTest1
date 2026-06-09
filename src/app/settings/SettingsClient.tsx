"use client";

import { useState } from "react";

type Props = {
  user: { name: string | null; email: string };
  threadsToken: { threadsUserId: string; expiresAt: string } | null;
  hasGeminiKey: boolean;
  threadsOAuthUrl: string | null;
  successMsg: string | null;
  errorMsg: string | null;
};

export default function SettingsClient({
  user,
  threadsToken,
  hasGeminiKey,
  threadsOAuthUrl,
  successMsg,
  errorMsg,
}: Props) {
  const [geminiKey, setGeminiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [keyError, setKeyError] = useState("");
  const [localHasKey, setLocalHasKey] = useState(hasGeminiKey);
  const [disconnecting, setDisconnecting] = useState(false);

  async function saveGeminiKey() {
    if (!geminiKey.trim()) return;
    setKeyStatus("saving");
    setKeyError("");

    const res = await fetch("/api/user/gemini-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: geminiKey.trim() }),
    });

    if (res.ok) {
      setKeyStatus("saved");
      setLocalHasKey(true);
      setGeminiKey("");
      setTimeout(() => setKeyStatus("idle"), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setKeyError(data.error ?? "저장 실패");
      setKeyStatus("error");
    }
  }

  async function deleteGeminiKey() {
    setKeyStatus("saving");
    const res = await fetch("/api/user/gemini-key", { method: "DELETE" });
    if (res.ok) {
      setLocalHasKey(false);
      setKeyStatus("idle");
    } else {
      setKeyStatus("error");
    }
  }

  async function disconnectThreads() {
    if (!confirm("Threads 연결을 해제하시겠습니까?")) return;
    setDisconnecting(true);
    await fetch("/api/threads/token", { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">설정</h1>
        <p className="text-slate-400 mt-1">{user.email}</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-500/20 border border-green-500/40 rounded-xl text-green-300 text-sm">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Threads 연결 */}
      <section className="bg-white/10 border border-white/20 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Threads 계정 연결</h2>
            <p className="text-slate-400 text-sm mt-1">
              게시 및 댓글 자동화를 위해 Threads 계정을 연결하세요
            </p>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            threadsToken ? "bg-green-500/20 text-green-400" : "bg-slate-600/40 text-slate-400"
          }`}>
            {threadsToken ? "연결됨" : "미연결"}
          </div>
        </div>

        <div className="mt-4">
          {threadsToken ? (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-300">
                <span className="text-slate-500">계정 ID: </span>
                {threadsToken.threadsUserId}
                <span className="ml-3 text-slate-500">만료: </span>
                {new Date(threadsToken.expiresAt).toLocaleDateString("ko-KR")}
              </div>
              <button
                onClick={disconnectThreads}
                disabled={disconnecting}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                {disconnecting ? "해제 중…" : "연결 해제"}
              </button>
            </div>
          ) : (
            <a
              href={threadsOAuthUrl ?? "#"}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                threadsOAuthUrl
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
            >
              {threadsOAuthUrl ? "Threads로 연결하기" : "THREADS_APP_ID 설정 필요"}
            </a>
          )}
        </div>
      </section>

      {/* Gemini API 키 */}
      <section className="bg-white/10 border border-white/20 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Gemini API 키</h2>
            <p className="text-slate-400 text-sm mt-1">
              서비스 무료 한도(20회/일) 초과 시 본인 키를 등록하면 제한 없이 사용할 수 있습니다
            </p>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            localHasKey ? "bg-green-500/20 text-green-400" : "bg-slate-600/40 text-slate-400"
          }`}>
            {localHasKey ? "등록됨" : "미등록"}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder={localHasKey ? "새 키로 덮어쓰기" : "AIza… 형식의 API 키"}
              className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              onKeyDown={(e) => e.key === "Enter" && saveGeminiKey()}
            />
            <button
              onClick={saveGeminiKey}
              disabled={keyStatus === "saving" || !geminiKey.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {keyStatus === "saving" ? "저장 중…" : keyStatus === "saved" ? "저장됨!" : "저장"}
            </button>
          </div>

          {keyError && <p className="text-xs text-red-400">{keyError}</p>}
          {keyStatus === "saved" && (
            <p className="text-xs text-green-400">API 키가 안전하게 암호화되어 저장되었습니다</p>
          )}

          {localHasKey && (
            <button
              onClick={deleteGeminiKey}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              등록된 키 삭제 (서비스 키 사용으로 전환)
            </button>
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          입력한 키는 AES-256으로 암호화되어 저장됩니다. Gemini API 키는{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline"
          >
            Google AI Studio
          </a>
          에서 발급받을 수 있습니다.
        </p>
      </section>
    </div>
  );
}
