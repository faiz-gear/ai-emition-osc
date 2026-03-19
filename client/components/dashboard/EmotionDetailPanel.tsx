import React from "react";

import { EmotionRadar } from "@/components/EmotionRadar";
import type { Utterance } from "@/lib/types";

type EmotionDetailPanelProps = {
  selectedUtterance: Utterance | null;
};

export function EmotionDetailPanel({ selectedUtterance }: EmotionDetailPanelProps) {
  if (!selectedUtterance) {
    return (
      <section className="dashboard-enter rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-[var(--space-4)] shadow-[0_8px_22px_rgba(17,19,24,0.05)]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Emotion Detail
        </p>
        <p className="mt-4 text-sm text-[color:var(--text-secondary)]">
          Select an utterance to inspect emotion details.
        </p>
      </section>
    );
  }

  const emotion = selectedUtterance.emotion;

  return (
    <section className="dashboard-enter rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-[var(--space-4)] shadow-[0_8px_22px_rgba(17,19,24,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Emotion Detail
        </p>
        <p className="mono text-[11px] text-[color:var(--text-secondary)]">{selectedUtterance.id}</p>
      </div>
      <p className="mt-2 text-sm text-[color:var(--text-primary)]">
        Dominant: <span className="font-semibold">{emotion?.dominant_emotion ?? "-"}</span>
      </p>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
        {emotion?.brief_explanation ?? "No emotion result yet."}
      </p>
      <div className="mt-2">
        <EmotionRadar emotion={emotion ?? null} />
      </div>
    </section>
  );
}
