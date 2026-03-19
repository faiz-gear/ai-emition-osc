import React from "react";

import type { Freshness } from "@/lib/dashboard/types";

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
  const displayText = text.trim() || "(Waiting for speech...)";

  return (
    <section className="dashboard-enter rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-[var(--space-4)] shadow-[0_8px_22px_rgba(17,19,24,0.05)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Live Transcript
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${freshnessClass(
              freshness,
            )}`}
          >
            {freshness}
          </span>
          <time className="mono text-[11px] text-[color:var(--text-secondary)]">
            {lastUpdatedAt
              ? new Date(lastUpdatedAt).toLocaleTimeString()
              : "--:--:--"}
          </time>
        </div>
      </div>

      <p
        data-testid="live-transcript-text"
        className={`mt-3 min-h-12 text-sm leading-6 text-[color:var(--text-primary)] ${
          isProcessing ? "transcript-shimmer" : ""
        }`}
      >
        {displayText}
      </p>
    </section>
  );
}
