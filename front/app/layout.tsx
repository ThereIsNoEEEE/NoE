import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "KMU Pick AI — 국민대 맞춤 공지",
  description: "학적과 관심사를 바탕으로 국민대학교 공지를 추천합니다.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 첫 페인트 전에 테마를 정해 깜빡임을 막는다: 저장값 → 시스템 설정 → 다크 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("kmu-pick-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
