import { JetBrains_Mono, Manrope } from "next/font/google";
import type { Metadata } from "next";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-ui",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

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
      <body className={`${manrope.variable} ${jetbrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
