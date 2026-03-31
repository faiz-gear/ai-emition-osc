"use client";

import React from "react";

import type { Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

type SettingsLanguageSectionProps = {
  locale: Locale;
  onChangeLocale: (next: Locale) => void;
};

export function SettingsLanguageSection({
  locale,
  onChangeLocale,
}: SettingsLanguageSectionProps) {
  const { t } = useI18n();

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
      <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
        {t("settingsLanguageTitle")}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
        {t("settingsLanguageDescription")}
      </p>

      <div className="mt-4 inline-flex rounded-full border border-[color:var(--border)] bg-white/90 p-1">
        <button
          type="button"
          aria-pressed={locale === "en"}
          onClick={() => onChangeLocale("en")}
          className="rounded-full px-4 py-1.5 text-sm font-semibold text-[color:var(--text-secondary)] aria-[pressed=true]:bg-[color:var(--accent-soft)] aria-[pressed=true]:text-[color:var(--accent)]"
        >
          {t("localeEnglish")}
        </button>
        <button
          type="button"
          aria-pressed={locale === "zh"}
          onClick={() => onChangeLocale("zh")}
          className="rounded-full px-4 py-1.5 text-sm font-semibold text-[color:var(--text-secondary)] aria-[pressed=true]:bg-[color:var(--accent-soft)] aria-[pressed=true]:text-[color:var(--accent)]"
        >
          {t("localeChinese")}
        </button>
      </div>
    </section>
  );
}
