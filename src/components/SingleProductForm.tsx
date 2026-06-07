"use client";

import { useRef, useState, type ChangeEvent } from "react";
import type { GenerateErrorBody, GenerateResponseBody } from "@/types/generate";
import { isValidUrl, isNonEmptyProductName } from "@/lib/validation";

interface ResultSectionProps {
  result: GenerateResponseBody;
  onReset: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-copy ${copied ? "copied" : ""}`}
    >
      {copied ? "✓ 복사됨" : "복사"}
    </button>
  );
}

function ResultSection({ result, onReset }: ResultSectionProps) {
  return (
    <div className="space-y-4 fade-in-up">
      {/* Target audience */}
      <div className="result-card">
        <p className="result-label mb-3">🎯 타겟 고객층 분석</p>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
          {result.targetAudience}
        </p>
      </div>

      {/* Threads */}
      <div className="result-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p className="result-label">🧵 쓰레드용 글</p>
          <CopyButton text={result.threadsPost} />
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
          {result.threadsPost}
        </p>
      </div>

      {/* Instagram */}
      <div className="result-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p className="result-label">📸 인스타그램용 글</p>
          <CopyButton text={result.instagramPost} />
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
          {result.instagramPost}
        </p>
      </div>

      {/* Blog */}
      <div className="result-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p className="result-label">✍️ 블로그용 글</p>
          <CopyButton text={result.blogPost} />
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
          {result.blogPost}
        </p>
      </div>

      {/* Image description */}
      <div className="result-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <p className="result-label">🖼️ 연출이미지 설명 (생성 프롬프트)</p>
          <CopyButton text={result.imageDescription} />
        </div>
        <p
          style={{
            color: "var(--text-muted)",
            fontSize: 13,
            lineHeight: 1.7,
            fontFamily: "var(--font-geist-mono)",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 8,
            padding: "12px 14px",
            whiteSpace: "pre-wrap",
          }}
        >
          {result.imageDescription}
        </p>
      </div>

      <button type="button" onClick={onReset} className="btn-secondary" style={{ width: "100%" }}>
        ↺ 다시 입력하기
      </button>
    </div>
  );
}

export default function SingleProductForm() {
  const [productName, setProductName] = useState("");
  const [representativeSiteUrl, setRepresentativeSiteUrl] = useState("");
  const [myStoreUrl, setMyStoreUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponseBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("JPG, PNG, WebP, GIF 형식의 이미지만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("이미지 파일은 4MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setError(null);
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
  }

  function handleRemoveImage() {
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
  }

  function handleReset() {
    setProductName("");
    setRepresentativeSiteUrl("");
    setMyStoreUrl("");
    handleRemoveImage();
    setResult(null);
    setError(null);
    setRetryable(false);
  }

  function validate(): string | null {
    if (!isNonEmptyProductName(productName)) return "상품명을 입력해주세요.";
    if (!isValidUrl(representativeSiteUrl)) return "대표판매사이트 URL이 올바른 형식이 아닙니다. (https://... 형태)";
    if (!isValidUrl(myStoreUrl)) return "내 판매페이지 URL이 올바른 형식이 아닙니다. (https://... 형태)";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      let res: Response;

      if (imageFile) {
        const formData = new FormData();
        formData.append("productName", productName);
        formData.append("representativeSiteUrl", representativeSiteUrl);
        formData.append("myStoreUrl", myStoreUrl);
        formData.append("image", imageFile);
        res = await fetch("/api/generate", { method: "POST", body: formData });
      } else {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productName, representativeSiteUrl, myStoreUrl }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        const errBody = data as GenerateErrorBody;
        setError(errBody.error);
        setRetryable(errBody.retryable);
        return;
      }
      setResult(data as GenerateResponseBody);
    } catch {
      setError("네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.");
      setRetryable(true);
    } finally {
      setIsLoading(false);
    }
  }

  if (result) {
    return <ResultSection result={result} onReset={handleReset} />;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {/* Product name */}
      <div>
        <label htmlFor="single-product-name" className="field-label">
          상품명 <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input
          id="single-product-name"
          type="text"
          className="input-field"
          placeholder="예: 제주 한라봉 5kg"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      {/* Representative site URL */}
      <div>
        <label htmlFor="single-rep-url" className="field-label">
          대표판매사이트 URL <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input
          id="single-rep-url"
          type="url"
          className="input-field"
          placeholder="https://smartstore.naver.com/..."
          value={representativeSiteUrl}
          onChange={(e) => setRepresentativeSiteUrl(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      {/* My store URL */}
      <div>
        <label htmlFor="single-store-url" className="field-label">
          내 판매페이지 URL <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input
          id="single-store-url"
          type="url"
          className="input-field"
          placeholder="https://my-private-store.example.com/..."
          value={myStoreUrl}
          onChange={(e) => setMyStoreUrl(e.target.value)}
          disabled={isLoading}
          required
        />
      </div>

      {/* Image upload */}
      <div>
        <label className="field-label">판매 이미지 (선택, 최대 4MB)</label>
        {imagePreviewUrl ? (
          <div style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreviewUrl} alt="상품 이미지 미리보기" className="img-preview" />
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={isLoading}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "rgba(0,0,0,0.6)",
                border: "none",
                borderRadius: "50%",
                width: 28,
                height: 28,
                color: "white",
                fontSize: 16,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
              aria-label="이미지 제거"
            >
              ×
            </button>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 6 }}>
              📎 {imageFile?.name} — AI가 이미지를 보고 글을 더 구체적으로 작성합니다
            </p>
          </div>
        ) : (
          <div
            className="upload-zone"
            onClick={() => !isLoading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isLoading) {
                fileInputRef.current?.click();
              }
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600 }}>
              클릭하여 이미지 업로드
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
              JPG · PNG · WebP · GIF — 최대 4MB
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageChange}
          disabled={isLoading}
          style={{ display: "none" }}
          aria-label="판매 이미지 업로드"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error fade-in-up">
          <p>{error}</p>
          {retryable && (
            <button
              type="submit"
              style={{
                marginTop: 8,
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 8,
                padding: "6px 14px",
                color: "#f87171",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary"
        style={{ width: "100%", fontSize: 16, padding: "14px 24px" }}
        id="single-generate-btn"
      >
        {isLoading ? (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span className="spinner" style={{ width: 18, height: 18 }} />
            AI가 분석하고 글을 쓰는 중...
          </span>
        ) : (
          "✨ 홍보 글 생성하기"
        )}
      </button>
    </form>
  );
}
