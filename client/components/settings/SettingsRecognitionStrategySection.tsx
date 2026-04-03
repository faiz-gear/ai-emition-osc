"use client";

import React from "react";

import type { FixedLanguage, RecognitionStrategy } from "@ai-emotion/contracts";

import { useI18n } from "@/lib/i18n";

type SettingsRecognitionStrategySectionProps = {
  value: RecognitionStrategy;
  disabled?: boolean;
  onChangeMode: (mode: RecognitionStrategy["mode"]) => void;
  onChangeFixedLanguage: (language: FixedLanguage) => void;
};

export function SettingsRecognitionStrategySection({
  value,
  disabled = false,
  onChangeMode,
  onChangeFixedLanguage,
}: SettingsRecognitionStrategySectionProps) {
  const { t } = useI18n();
  const fixedLanguage = value.mode === "fixed" ? value.fixedLanguage : "en";

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
      <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
        {t("settingsRecognitionStrategyTitle")}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
        {t("settingsRecognitionStrategyDescription")}
      </p>
      {disabled ? (
        <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-[color:var(--warning)]">
          {t("settingsRecognitionStrategyListeningBlocked")}
        </div>
      ) : null}

      <fieldset className="mt-4 grid gap-3" disabled={disabled}>
        <label className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--text-primary)]">
          <input
            type="radio"
            name="recognition-strategy"
            disabled={disabled}
            checked={value.mode === "auto"}
            onChange={() => onChangeMode("auto")}
          />
          <span>{t("settingsRecognitionStrategyAuto")}</span>
        </label>

        <label className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm text-[color:var(--text-primary)]">
          <span className="flex items-center gap-3">
            <input
              type="radio"
              name="recognition-strategy"
              disabled={disabled}
              checked={value.mode === "fixed"}
              onChange={() => onChangeMode("fixed")}
            />
            <span>{t("settingsRecognitionStrategyFixed")}</span>
          </span>

          {value.mode === "fixed" ? (
            <label className="grid gap-1 text-sm text-[color:var(--text-secondary)]">
              <span className="font-semibold text-[color:var(--text-primary)]">
                {t("settingsRecognitionStrategyFixedLabel")}
              </span>
              <select
                aria-label={t("settingsRecognitionStrategyFixedLabel")}
                disabled={disabled}
                value={fixedLanguage}
                onChange={(event) =>
                  onChangeFixedLanguage(event.target.value as FixedLanguage)
                }
                className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
              >
                <option value="en">{t("settingsRecognitionStrategyEnglish")}</option>
                <option value="zh">{t("settingsRecognitionStrategyChinese")}</option>
              </select>
            </label>
          ) : null}
        </label>
      </fieldset>
    </section>
  );
}
