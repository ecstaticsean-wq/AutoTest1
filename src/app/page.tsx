"use client";

import { useState } from "react";
import SingleProductForm from "@/components/SingleProductForm";
import BatchProductForm from "@/components/PromoGeneratorForm";

type Tab = "single" | "batch";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("single");

  return (
    <main
      style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        padding: "40px 16px 80px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header */}
      <header style={{ width: "100%", maxWidth: 680, marginBottom: 40, textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: 20,
            padding: "6px 16px",
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 12 }}>✦</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#a78bfa",
            }}
          >
            AI 마케팅 어시스턴트
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 42px)",
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}
        >
          상품 타게팅{" "}
          <span className="gradient-text">홍보 AI 직원</span>
        </h1>

        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "clamp(14px, 2.5vw, 16px)",
            lineHeight: 1.7,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          상품명과 URL을 입력하면 타겟 고객층을 분석하고
          <br />
          쓰레드·인스타·블로그 홍보 글을 바로 생성해드립니다.
        </p>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginTop: 20,
          }}
        >
          {["🎯 타겟 분석", "🧵 쓰레드", "📸 인스타", "✍️ 블로그", "🖼️ 이미지 프롬프트"].map((pill) => (
            <span
              key={pill}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: 12,
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              {pill}
            </span>
          ))}
        </div>
      </header>

      {/* Card */}
      <div
        className="glass-card"
        style={{
          width: "100%",
          maxWidth: 680,
          padding: "28px 32px",
          boxShadow: "var(--shadow-glow)",
        }}
      >
        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom: 28 }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === "single" ? "active" : ""}`}
            onClick={() => setActiveTab("single")}
            id="tab-single"
          >
            ✦ 단일 상품 입력
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "batch" ? "active" : ""}`}
            onClick={() => setActiveTab("batch")}
            id="tab-batch"
          >
            📊 엑셀 일괄 처리
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "single" ? <SingleProductForm /> : <BatchProductForm />}
      </div>

      {/* Footer */}
      <footer
        style={{
          marginTop: 40,
          color: "var(--text-muted)",
          fontSize: 12,
          textAlign: "center",
          lineHeight: 1.8,
        }}
      >
        <p>Powered by Gemini 2.5 Flash · 생성된 글은 직접 검토 후 사용을 권장합니다</p>
      </footer>
    </main>
  );
}
