"use client";

import { useState, useSyncExternalStore, type ChangeEvent } from "react";
import {
  downloadProductExcelTemplate,
  downloadProductRowsAsExcel,
  parseProductExcel,
  type ParsedProductRow,
  type RowError,
} from "@/lib/excel";
import { DAILY_FREE_LIMIT, getRemainingQuota, recordUsage } from "@/lib/quota";
import type { GenerateErrorBody, GenerateRequestBody, GenerateResponseBody } from "@/types/generate";

type BatchStage = "upload" | "preview" | "processing" | "done";
type ItemStatus = "pending" | "processing" | "done" | "error" | "skipped";

interface ApiOutcome {
  result?: GenerateResponseBody;
  error?: { message: string; retryable: boolean };
}

interface BatchItem {
  row: ParsedProductRow;
  status: ItemStatus;
  result?: GenerateResponseBody;
  error?: { message: string; retryable: boolean };
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: "대기 중",
  processing: "생성 중...",
  done: "완료",
  error: "실패",
  skipped: "한도 초과로 보류",
};

const STATUS_BADGE_CLASS: Record<ItemStatus, string> = {
  pending: "badge badge-pending",
  processing: "badge badge-processing",
  done: "badge badge-done",
  error: "badge badge-error",
  skipped: "badge badge-skipped",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={`btn-copy ${copied ? "copied" : ""}`}
    >
      {copied ? "✓ 복사됨" : "복사"}
    </button>
  );
}

function ResultField({ label, text }: { label: string; text: string }) {
  return (
    <div className="result-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p className="result-label">{label}</p>
        <CopyButton text={text} />
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
        {text}
      </p>
    </div>
  );
}

function subscribeToQuota(): () => void {
  return () => {};
}

function getServerQuotaSnapshot(): null {
  return null;
}

async function callGenerate(row: ParsedProductRow): Promise<ApiOutcome> {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: row.productName,
        representativeSiteUrl: row.representativeSiteUrl,
        myStoreUrl: row.myStoreUrl,
      } satisfies GenerateRequestBody),
    });

    const data = await res.json();
    if (!res.ok) {
      const err = data as GenerateErrorBody;
      return { error: { message: err.error, retryable: err.retryable } };
    }
    return { result: data as GenerateResponseBody };
  } catch {
    return {
      error: {
        message: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.",
        retryable: true,
      },
    };
  }
}

export default function BatchProductForm() {
  const [stage, setStage] = useState<BatchStage>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const remainingQuota = useSyncExternalStore(subscribeToQuota, getRemainingQuota, getServerQuotaSnapshot);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFileName(file.name);
    setFileError(null);
    setRowErrors([]);
    setParsedRows([]);
    setIsParsing(true);

    try {
      const parsed = await parseProductExcel(file);
      if (parsed.fileError) {
        setFileError(parsed.fileError);
        return;
      }
      if (parsed.rows.length === 0 && parsed.rowErrors.length === 0) {
        setFileError("엑셀에서 입력된 상품 데이터를 찾지 못했습니다. 템플릿의 2행부터 데이터를 입력해주세요.");
        return;
      }
      setRowErrors(parsed.rowErrors);
      setParsedRows(parsed.rows);
      setStage("preview");
    } finally {
      setIsParsing(false);
    }
  }

  function handleBackToUpload() {
    setStage("upload");
    setFileName(null);
    setFileError(null);
    setRowErrors([]);
    setParsedRows([]);
    setItems([]);
  }

  async function handleStartBatch() {
    const initialItems: BatchItem[] = parsedRows.map((row) => ({ row, status: "pending" }));
    setItems(initialItems);
    setStage("processing");

    for (let i = 0; i < initialItems.length; i++) {
      if (getRemainingQuota() <= 0) {
        setItems((prev) =>
          prev.map((it, idx) => (idx >= i && it.status === "pending" ? { ...it, status: "skipped" } : it))
        );
        break;
      }

      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "processing" } : it)));
      const outcome = await callGenerate(initialItems[i].row);
      recordUsage();
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i
            ? { ...it, status: outcome.result ? "done" : "error", result: outcome.result, error: outcome.error }
            : it
        )
      );
    }

    setStage("done");
  }

  async function handleDownloadSkipped() {
    const skippedRows = items.filter((it) => it.status === "skipped").map((it) => it.row);
    if (skippedRows.length === 0) return;
    await downloadProductRowsAsExcel(skippedRows, "보류된_상품목록.xlsx");
  }

  async function handleRetryItem(index: number, row: ParsedProductRow) {
    if (getRemainingQuota() <= 0) {
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? {
                ...it,
                status: "error",
                error: { message: "오늘의 무료 생성 한도를 모두 사용했습니다. 내일 다시 시도해주세요.", retryable: false },
              }
            : it
        )
      );
      return;
    }

    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, status: "processing", error: undefined } : it))
    );
    const outcome = await callGenerate(row);
    recordUsage();
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === index
          ? { ...it, status: outcome.result ? "done" : "error", result: outcome.result, error: outcome.error }
          : it
      )
    );
  }

  const doneCount = items.filter(
    (it) => it.status === "done" || it.status === "error" || it.status === "skipped"
  ).length;
  const successCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;
  const skippedCount = items.filter((it) => it.status === "skipped").length;
  const progressPct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {stage === "upload" && (
        <div className="space-y-5 fade-in-up">
          {remainingQuota !== null && (
            <div className="alert-info" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>오늘 남은 무료 생성 가능 횟수</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {remainingQuota} / {DAILY_FREE_LIMIT}개
              </span>
            </div>
          )}

          <div className="glass-card" style={{ padding: "20px 24px" }}>
            <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              📊 엑셀 파일로 여러 상품을 한 번에 등록
            </p>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
              아래 3개 열을 가진 엑셀(.xlsx) 파일을 업로드하면 상품마다 홍보 글을 자동 생성합니다.
            </p>
            <ul style={{ color: "var(--text-muted)", fontSize: 13, paddingLeft: 20, marginTop: 8, lineHeight: 1.9 }}>
              <li>상품명</li>
              <li>대표판매사이트 URL</li>
              <li>내 판매페이지 URL</li>
            </ul>
            <button
              type="button"
              onClick={() => void downloadProductExcelTemplate()}
              className="btn-secondary"
              style={{ marginTop: 14, fontSize: 13 }}
              id="download-template-btn"
            >
              ↓ 엑셀 템플릿 내려받기
            </button>
          </div>

          <div>
            <label className="field-label">엑셀 파일 업로드 (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => void handleFileChange(e)}
              className="input-field"
              style={{ cursor: "pointer" }}
              disabled={isParsing}
              id="batch-excel-upload"
            />
            {fileName && (
              <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>
                📎 {fileName}
              </p>
            )}
            {isParsing && (
              <p style={{ color: "var(--accent-secondary)", fontSize: 13, marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                엑셀 파일을 읽는 중입니다...
              </p>
            )}
            {fileError && <p className="alert-error" style={{ marginTop: 8 }}>{fileError}</p>}
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div className="space-y-4 fade-in-up">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ fontWeight: 700, fontSize: 15 }}>
              업로드 내용 확인 ({parsedRows.length}개 상품)
            </h3>
            <button type="button" onClick={handleBackToUpload} className="btn-secondary" style={{ fontSize: 13 }}>
              ← 다른 파일 선택
            </button>
          </div>

          {remainingQuota !== null && parsedRows.length > remainingQuota && (
            <div className="alert-warning">
              오늘 남은 무료 생성 가능 횟수는 <strong>{remainingQuota}개</strong>입니다.
              {remainingQuota > 0
                ? ` 먼저 ${remainingQuota}개 상품만 생성되고, 나머지 ${parsedRows.length - remainingQuota}개는 보류 처리됩니다.`
                : " 오늘 생성 가능한 횟수를 모두 사용했습니다. 내일 다시 시도해주세요."}
            </div>
          )}

          {rowErrors.length > 0 && (
            <div className="alert-error">
              <p style={{ fontWeight: 700, marginBottom: 4 }}>
                다음 행은 형식 오류로 제외됩니다 ({rowErrors.length}개):
              </p>
              <ul style={{ paddingLeft: 18, lineHeight: 1.9 }}>
                {rowErrors.map((re) => (
                  <li key={re.rowNumber}>
                    {re.rowNumber}행: {re.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsedRows.length > 0 ? (
            <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>행</th>
                    <th>상품명</th>
                    <th>대표판매사이트 URL</th>
                    <th>내 판매페이지 URL</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td style={{ color: "var(--text-muted)" }}>{row.rowNumber}</td>
                      <td style={{ color: "var(--text-primary)" }}>{row.productName}</td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.representativeSiteUrl}
                      </td>
                      <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.myStoreUrl}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              생성을 진행할 수 있는 상품이 없습니다. 엑셀 내용을 확인해주세요.
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleStartBatch()}
            disabled={parsedRows.length === 0 || remainingQuota === 0}
            className="btn-primary"
            style={{ width: "100%" }}
            id="batch-start-btn"
          >
            {remainingQuota !== null && remainingQuota > 0 && remainingQuota < parsedRows.length
              ? `✨ ${remainingQuota}개 상품 우선 생성 시작`
              : `✨ ${parsedRows.length}개 상품 일괄 생성 시작`}
          </button>
        </div>
      )}

      {(stage === "processing" || stage === "done") && (
        <div className="space-y-4 fade-in-up">
          {/* Progress header */}
          <div className="glass-card" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: stage === "processing" ? 10 : 0 }}>
              <p style={{ fontWeight: 700 }}>
                {stage === "processing"
                  ? `생성 진행 중... (${doneCount}/${items.length})`
                  : `생성 완료 — 성공 ${successCount}개 / 실패 ${errorCount}개${skippedCount > 0 ? ` / 보류 ${skippedCount}개` : ""}`}
              </p>
              {stage === "processing" && <span className="spinner" />}
              {stage === "done" && <span style={{ color: "var(--success)", fontSize: 18 }}>✓</span>}
            </div>
            {stage === "processing" && (
              <>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>
                  화면을 닫지 말고 잠시만 기다려주세요.
                </p>
              </>
            )}
          </div>

          {stage === "done" && skippedCount > 0 && (
            <div className="alert-warning">
              <p style={{ marginBottom: 10 }}>
                오늘의 무료 생성 한도({DAILY_FREE_LIMIT}개)를 모두 사용해 {skippedCount}개 상품이 보류되었습니다.
                내일 한도가 초기화된 후 다시 시도하거나, 아래 버튼으로 보류된 상품만 엑셀로 받아 나중에 업로드할 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => void handleDownloadSkipped()}
                style={{
                  background: "rgba(245,158,11,0.15)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: 8,
                  padding: "7px 16px",
                  color: "#fbbf24",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ↓ 보류된 상품만 엑셀로 받기
              </button>
            </div>
          )}

          <div className="space-y-3">
            {items.map((item, index) => (
              <details key={item.row.rowNumber} className="batch-item" open={item.status === "error"}>
                <summary>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                    {item.row.rowNumber}행 · {item.row.productName}
                  </span>
                  <span className={STATUS_BADGE_CLASS[item.status]}>
                    {item.status === "processing" && (
                      <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, marginRight: 4 }} />
                    )}
                    {STATUS_LABEL[item.status]}
                  </span>
                </summary>

                <div className="batch-item-body space-y-3">
                  {item.status === "skipped" && (
                    <div className="alert-warning" style={{ marginTop: 16 }}>
                      오늘의 무료 생성 한도를 모두 사용해 이 상품은 생성하지 못했습니다.
                    </div>
                  )}

                  {item.status === "error" && item.error && (
                    <div className="alert-error" style={{ marginTop: 16 }}>
                      <p>{item.error.message}</p>
                      {item.error.retryable && (
                        <button
                          type="button"
                          onClick={() => void handleRetryItem(index, item.row)}
                          style={{
                            marginTop: 8,
                            background: "rgba(239,68,68,0.15)",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: 8,
                            padding: "6px 14px",
                            color: "#f87171",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          이 상품만 다시 시도
                        </button>
                      )}
                    </div>
                  )}

                  {item.status === "done" && item.result && (
                    <div className="space-y-3" style={{ marginTop: 16 }}>
                      <div className="result-card">
                        <p className="result-label" style={{ marginBottom: 8 }}>🎯 타겟 고객층 분석</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
                          {item.result.targetAudience}
                        </p>
                      </div>
                      <ResultField label="🧵 쓰레드용 글" text={item.result.threadsPost} />
                      <ResultField label="📸 인스타그램용 글" text={item.result.instagramPost} />
                      <ResultField label="✍️ 블로그용 글" text={item.result.blogPost} />
                      <ResultField label="🖼️ 연출이미지 설명" text={item.result.imageDescription} />
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>

          {stage === "done" && (
            <button
              type="button"
              onClick={handleBackToUpload}
              className="btn-secondary"
              style={{ width: "100%" }}
            >
              ↺ 새 엑셀 업로드하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
