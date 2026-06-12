"use client";

import { useState, useRef } from "react";
import {
  parseProductExcel,
  downloadProductExcelTemplate,
  downloadRowsAsExcel,
  type ParsedProductRow,
} from "@/lib/excel";
import type { ThreadsGenerateResponse } from "@/types/generate";

type ItemStatus = "pending" | "generating" | "done" | "error" | "skipped" | "scheduled";

type GeneratedItem = {
  row: ParsedProductRow;
  status: ItemStatus;
  result?: ThreadsGenerateResponse;
  error?: string;
};

type Props = {
  hasThreadsToken: boolean;
};

// Format a Date as "YYYY-MM-DDTHH:mm" in local time for <input type="datetime-local">
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function ThreadsUploadFlow({ hasThreadsToken }: Props) {
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<{ rowNumber: number; message: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scheduleStartAt, setScheduleStartAt] = useState(() =>
    toDatetimeLocalValue(new Date(Date.now() + 10 * 60 * 1000))
  );
  const [scheduleInterval, setScheduleInterval] = useState(60);
  const [scheduling, setScheduling] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const skippedCount = items.filter((i) => i.status === "skipped").length;
  const scheduledCount = items.filter((i) => i.status === "scheduled").length;
  const progress = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  async function handleFile(file: File) {
    setFileError(null);
    setRowErrors([]);
    setItems([]);

    const result = await parseProductExcel(file);
    if (result.fileError) {
      setFileError(result.fileError);
      return;
    }

    setRowErrors(result.rowErrors);
    setItems(result.rows.map((row) => ({ row, status: "pending" })));
  }

  async function runGeneration() {
    if (running || items.length === 0) return;
    setRunning(true);

    const updated = items.map((i) =>
      i.status === "pending" ? { ...i, status: "pending" as ItemStatus } : i
    );
    setItems([...updated]);

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.status !== "pending") continue;

      updated[i] = { ...item, status: "generating" };
      setItems([...updated]);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productName: item.row.productName,
            salesUrl: item.row.salesUrl,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          updated[i] = { ...updated[i], status: "error", error: data.error };
        } else {
          updated[i] = { ...updated[i], status: "done", result: data };
        }
      } catch {
        updated[i] = { ...updated[i], status: "error", error: "네트워크 오류" };
      }

      setItems([...updated]);
    }

    setRunning(false);
  }

  async function publishPost(index: number) {
    const item = items[index];
    if (!item.result || !hasThreadsToken) return;

    setPublishingId(`${index}`);
    try {
      const res = await fetch("/api/threads/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postText: item.result.postText,
          productName: item.row.productName,
          salesUrl: item.row.salesUrl,
          postFormat: item.result.postFormat,
        }),
      });

      if (res.ok) {
        const updated = [...items];
        updated[index] = { ...updated[index], status: "skipped" };
        setItems(updated);
        alert("딸깍! Threads에 게시되었습니다 🎉");
      } else {
        const data = await res.json();
        alert(`게시 실패: ${data.error}`);
      }
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setPublishingId(null);
    }
  }

  function toggleSelected(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function scheduleSelected() {
    const targets = items
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => item.status === "done" && selected.has(index));

    if (targets.length === 0 || !hasThreadsToken) return;

    const startAt = new Date(scheduleStartAt);
    if (Number.isNaN(startAt.getTime())) {
      alert("발행 시작 시간을 확인해주세요");
      return;
    }

    setScheduling(true);
    try {
      const res = await fetch("/api/threads/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: targets.map(({ item }) => ({
            postText: item.result!.postText,
            productName: item.row.productName,
            salesUrl: item.row.salesUrl,
            postFormat: item.result!.postFormat,
          })),
          startAt: startAt.toISOString(),
          intervalMinutes: scheduleInterval,
        }),
      });

      if (res.ok) {
        const updated = [...items];
        for (const { index } of targets) {
          updated[index] = { ...updated[index], status: "scheduled" };
        }
        setItems(updated);
        setSelected(new Set());
        alert(`${targets.length}개 글이 예약 발행 등록되었습니다 🎉`);
      } else {
        const data = await res.json();
        alert(`예약 실패: ${data.error}`);
      }
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setScheduling(false);
    }
  }

  async function downloadErrors() {
    const errorRows = items
      .filter((i) => i.status === "error")
      .map((i) => ({ productName: i.row.productName, salesUrl: i.row.salesUrl }));
    await downloadRowsAsExcel(errorRows, "실패_상품목록.xlsx");
  }

  return (
    <div className="space-y-6">
      {/* 파일 업로드 */}
      <div className="bg-white/10 border border-white/20 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-lg mb-1">제품 리스트 업로드</h2>
        <p className="text-slate-400 text-sm mb-4">
          상품명 + 판매URL 2열 엑셀 파일을 업로드하세요
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            엑셀 파일 선택
          </button>
          <button
            onClick={downloadProductExcelTemplate}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
          >
            템플릿 다운로드
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {fileError && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
            {fileError}
          </div>
        )}

        {rowErrors.length > 0 && (
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
            <p className="text-yellow-300 font-medium mb-1">
              {rowErrors.length}개 행에서 오류 발견 (건너뜀):
            </p>
            {rowErrors.map((e) => (
              <p key={e.rowNumber} className="text-yellow-400/80 text-xs">
                행 {e.rowNumber}: {e.message}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* 생성 컨트롤 */}
      {items.length > 0 && (
        <div className="bg-white/10 border border-white/20 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-medium">
                {items.length}개 상품 준비됨
              </p>
              {running && (
                <p className="text-slate-400 text-sm mt-0.5">
                  생성 중… ({doneCount + errorCount}/{items.length})
                </p>
              )}
              {!running && (doneCount > 0 || errorCount > 0) && (
                <p className="text-slate-400 text-sm mt-0.5">
                  완료 {doneCount}개 / 실패 {errorCount}개
                  {skippedCount > 0 && ` / 게시됨 ${skippedCount}개`}
                  {scheduledCount > 0 && ` / 예약됨 ${scheduledCount}개`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {errorCount > 0 && !running && (
                <button
                  onClick={downloadErrors}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
                >
                  실패 목록 다운로드
                </button>
              )}
              <button
                onClick={runGeneration}
                disabled={running}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {running ? "생성 중…" : doneCount > 0 ? "다시 생성" : "AI 글 생성 시작"}
              </button>
            </div>
          </div>

          {running && (
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* 일괄 예약 발행 */}
      {hasThreadsToken && doneCount > 0 && (
        <div className="bg-white/10 border border-white/20 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-1">일괄 예약 발행</h2>
          <p className="text-slate-400 text-sm mb-4">
            아래 글 목록에서 발행할 글을 선택한 뒤, 시작 시간과 간격을 정하면 순서대로 자동
            발행됩니다.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-slate-400 text-xs mb-1">발행 시작 시간</label>
              <input
                type="datetime-local"
                value={scheduleStartAt}
                onChange={(e) => setScheduleStartAt(e.target.value)}
                className="bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1">발행 간격 (분)</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={scheduleInterval}
                onChange={(e) => setScheduleInterval(Number(e.target.value))}
                className="bg-black/30 border border-white/20 rounded-lg px-3 py-2 text-white text-sm w-24"
              />
            </div>
            <button
              onClick={scheduleSelected}
              disabled={scheduling || selected.size === 0}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {scheduling ? "예약 중…" : `선택한 ${selected.size}개 예약 발행`}
            </button>
          </div>
        </div>
      )}

      {/* 결과 카드 목록 */}
      {items.filter((i) => i.status === "done").length > 0 && (
        <div className="space-y-4">
          {items.map((item, index) => {
            if (item.status !== "done") return null;
            return (
              <div
                key={item.row.rowNumber}
                className="bg-white/10 border border-white/20 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3">
                    {hasThreadsToken && (
                      <input
                        type="checkbox"
                        checked={selected.has(index)}
                        onChange={() => toggleSelected(index)}
                        className="mt-1.5 w-4 h-4 accent-purple-600"
                      />
                    )}
                    <div>
                      <p className="text-white font-medium">{item.row.productName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                          {item.result!.postFormat}
                        </span>
                        <span className="text-slate-500 text-xs truncate max-w-xs">
                          {item.result!.engagementHook}
                        </span>
                      </div>
                    </div>
                  </div>

                  {hasThreadsToken && (
                    <button
                      onClick={() => publishPost(index)}
                      disabled={publishingId === `${index}`}
                      className="flex-shrink-0 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {publishingId === `${index}` ? "게시 중…" : "딸깍 발행"}
                    </button>
                  )}
                </div>

                <div className="bg-black/20 rounded-xl p-4">
                  <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                    {item.result!.postText}
                  </p>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(item.result!.postText);
                    }}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    복사
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasThreadsToken && items.some((i) => i.status === "done") && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-300">
          Threads 계정을 연결하면 &quot;딸깍 발행&quot; 버튼으로 바로 게시할 수 있습니다.{" "}
          <a href="/settings" className="underline hover:text-yellow-200">
            설정에서 연결하기 →
          </a>
        </div>
      )}
    </div>
  );
}
