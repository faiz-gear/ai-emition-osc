"use client";

import Link from "next/link";
import React from "react";

import { useI18n } from "@/lib/i18n";

type AppShellProps = {
  activeTab: "console" | "settings";
  children: React.ReactNode;
};

export function AppShell({ activeTab, children }: AppShellProps) {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-6 md:py-7">
      <header className="dashboard-enter rounded-[2.25rem] border border-white/60 bg-white/70 p-5 backdrop-blur-sm">
        <nav aria-label="Primary">
          <ul className="inline-flex rounded-full border border-[color:var(--border)] bg-white/85 p-1">
            <li>
              <Link
                href="/"
                aria-current={activeTab === "console" ? "page" : undefined}
                className="inline-flex rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)] aria-[current=page]:bg-[color:var(--accent-soft)] aria-[current=page]:text-[color:var(--accent)]"
              >
                {t("navConsole")}
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                aria-current={activeTab === "settings" ? "page" : undefined}
                className="inline-flex rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)] aria-[current=page]:bg-[color:var(--accent-soft)] aria-[current=page]:text-[color:var(--accent)]"
              >
                {t("navSettings")}
              </Link>
            </li>
          </ul>
        </nav>
      </header>
      {children}
    </main>
  );
}
