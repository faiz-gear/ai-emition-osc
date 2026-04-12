import type { Metadata } from "next";

import { ClientProviders } from "@/components/providers/ClientProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Emotion Monitor",
  description: "Speech recognition visualization, tracking and monitoring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
