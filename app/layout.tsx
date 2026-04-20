import "./globals.css";
import type { Metadata } from "next";
import { bodyFont } from "./fonts";

export const metadata: Metadata = {
  title: "100種類飲むまで帰れません！",
  description: "〜酒飲めるやつが1番偉い〜",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={bodyFont.className}>{children}</body>
    </html>
  );
}