import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LCA 프로젝트 관리",
  description: "가상 프로젝트로 LCA 업무를 연습하고 계정별 기록을 보관하는 학습용 프로그램입니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
