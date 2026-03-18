import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Emotion Monitor",
  description: "Speech recognition visualization, tracking and monitoring"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

