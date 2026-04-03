"use client";

import React from "react";

import { useI18n } from "@/lib/i18n";

import { SettingsLanguageSection } from "./SettingsLanguageSection";

export function SettingsPage() {
  const { locale, setLocale, t } = useI18n();

  return (
    <section className="grid gap-5">
      <header className="rounded-[1.75rem] border border-[color:var(--border)] bg-white/85 p-5">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">
          {t("settingsTitle")}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          {t("settingsDescription")}
        </p>
      </header>

      <SettingsLanguageSection locale={locale} onChangeLocale={setLocale} />
    </section>
  );
}
