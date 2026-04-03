import React from "react";

import { EmotionRadar } from "@/components/EmotionRadar";
import { useI18n } from "@/lib/i18n";
import type { Utterance } from "@/lib/types";

type EmotionDetailPanelProps = {
  selectedUtterance: Utterance | null;
};

export function EmotionDetailPanel({ selectedUtterance }: EmotionDetailPanelProps) {
  const { t } = useI18n();

  if (!selectedUtterance) {
    return (
      <section className="dashboard-enter rounded-[2.25rem] border border-white/65 bg-[color:rgba(255,255,255,0.82)] p-6 shadow-[0_20px_40px_-28px_rgba(18,25,20,0.3),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
          {t("emotionDetail")}
        </p>
        <p className="mt-4 text-sm text-[color:var(--text-secondary)]">
          {t("selectUtteranceHint")}
        </p>
      </section>
    );
  }

  const emotion = selectedUtterance.emotion;

  return (
    <section className="dashboard-enter rounded-[2.25rem] border border-white/65 bg-[color:rgba(255,255,255,0.82)] p-6 shadow-[0_20px_40px_-28px_rgba(18,25,20,0.3),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
          {t("emotionDetail")}
        </p>
        <p className="mono rounded-full border border-[color:rgba(21,26,23,0.08)] px-2 py-1 text-[11px] text-[color:var(--text-secondary)]">
          {selectedUtterance.id}
        </p>
      </div>
      <p className="mt-3 text-sm text-[color:var(--text-primary)]">
        {t("dominant")}: <span className="font-semibold">{emotion?.dominant_emotion ?? "-"}</span>
      </p>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
        {emotion?.brief_explanation ?? t("noEmotionResultYet")}
      </p>
      <div className="mt-3 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-2">
        <EmotionRadar emotion={emotion ?? null} />
      </div>
    </section>
  );
}
