import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "상품 타게팅 홍보 AI 직원 | 자동 마케팅 카피 생성",
  description:
    "상품 정보를 입력하면 AI가 타겟 고객을 분석하고 쓰레드·인스타·블로그 홍보 글을 자동으로 생성합니다.",
  keywords: "홍보글 자동생성, AI 마케팅, 쓰레드 글쓰기, 블로그 글쓰기, 이커머스 셀러",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
