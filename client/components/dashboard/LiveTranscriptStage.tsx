import React from "react";

import type { Freshness } from "@/lib/dashboard/types";
import { useI18n } from "@/lib/i18n";

type LiveTranscriptStageProps = {
  text: string;
  isProcessing: boolean;
  freshness: Freshness;
  lastUpdatedAt?: number | null;
};

function freshnessClass(freshness: Freshness) {
  if (freshness === "LIVE") {
    return "bg-[color:rgba(31,157,85,0.12)] text-[color:var(--success)] border-[color:rgba(31,157,85,0.4)]";
  }

  if (freshness === "IDLE") {
    return "bg-[color:rgba(183,121,31,0.12)] text-[color:var(--warning)] border-[color:rgba(183,121,31,0.4)]";
  }

  return "bg-[color:rgba(95,100,112,0.12)] text-[color:var(--text-secondary)] border-[color:rgba(95,100,112,0.35)]";
}

export function LiveTranscriptStage({
  text,
  isProcessing,
  freshness,
  lastUpdatedAt,
}: LiveTranscriptStageProps) {
  const { locale, t } = useI18n();
  const trimmedText = text.trim();
  const isEmpty = trimmedText.length === 0;
  const displayText = trimmedText || t("waitingForSpeech");
  const freshnessLabel =
    freshness === "LIVE"
      ? t("freshnessLive")
      : freshness === "IDLE"
        ? t("freshnessIdle")
        : t("freshnessStale");

  return (
    <section className="dashboard-enter rounded-[2.25rem] border border-white/65 bg-[color:rgba(255,255,255,0.82)] p-6 shadow-[0_20px_40px_-28px_rgba(18,25,20,0.3),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
          {t("liveTranscript")}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${freshnessClass(
              freshness,
            )}`}
          >
            {freshnessLabel}
          </span>
          <time className="mono text-[11px] text-[color:var(--text-secondary)]">
            {lastUpdatedAt
              ? new Date(lastUpdatedAt).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US")
              : "--:--:--"}
          </time>
        </div>
      </div>

      <p
        data-testid="live-transcript-text"
        className={`mt-4 min-h-12 rounded-2xl border border-[color:rgba(21,26,23,0.08)] bg-[color:rgba(255,255,255,0.75)] px-4 py-3 text-sm leading-6 text-[color:var(--text-primary)] ${
          isProcessing ? "transcript-shimmer" : ""
        }`}
      >
        {displayText}
      </p>

      {isEmpty ? (
        <p className="mt-2 text-xs leading-relaxed text-[color:var(--text-secondary)]">
          {t("startListeningHint")}
        </p>
      ) : null}
    </section>
  );
}
