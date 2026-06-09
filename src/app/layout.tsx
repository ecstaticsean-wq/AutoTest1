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
  title: "딸깍 쓰레드 | Threads 소통형 자동화",
  description:
    "제품 리스트를 업로드하면 AI가 Threads 소통형 글을 생성하고 자동으로 게시·댓글까지 관리합니다.",
  keywords: "쓰레드 자동화, AI 마케팅, Threads 글쓰기, 소통형 SNS, 이커머스 셀러",
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
