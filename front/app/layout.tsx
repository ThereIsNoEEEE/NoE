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
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
