import React from "react";

import { useI18n } from "@/lib/i18n";
import type { Metrics } from "@/lib/types";

type RealtimeOpsStackProps = {
  metrics: Metrics | null;
};

function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return String(Math.round(value));
}

export function RealtimeOpsStack({ metrics }: RealtimeOpsStackProps) {
  const { t } = useI18n();

  const items = [
    { label: t("latency"), value: formatValue(metrics?.avg_emotion_latency_ms), unit: t("unitMs") },
    { label: t("queue"), value: String(metrics?.emotion_queue_depth ?? 0), unit: t("unitCount") },
    { label: t("utterances"), value: String(metrics?.utterances_total ?? 0), unit: t("unitTotal") },
    { label: t("emotion"), value: String(metrics?.emotion_total ?? 0), unit: t("unitTotal") },
    { label: t("errors"), value: String(metrics?.errors_total ?? 0), unit: t("unitTotal") },
    { label: t("ws"), value: String(metrics?.ws_clients ?? 0), unit: t("unitClients") },
  ];

  const [heroMetric, ...secondaryMetrics] = items;
  const tickerItems = [...items, ...items];

  return (
    <section className="dashboard-enter overflow-hidden rounded-[2.25rem] border border-white/65 bg-[color:rgba(255,255,255,0.82)] p-6 shadow-[0_20px_40px_-28px_rgba(18,25,20,0.3),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
        {t("realtimeOps")}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.45fr_1fr]">
        <article className="rounded-3xl border border-[color:rgba(15,118,110,0.24)] bg-[color:var(--accent-soft)] px-4 py-3">
          <p className="text-xs text-[color:var(--text-secondary)]">{heroMetric.label}</p>
          <p className="mono mt-2 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)]">
            {heroMetric.value}
            <span className="ml-1 text-sm font-medium text-[color:var(--text-secondary)]">
              {heroMetric.unit}
            </span>
          </p>
        </article>

        <div className="grid grid-cols-2 gap-2">
          {secondaryMetrics.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2"
            >
              <p className="text-[11px] text-[color:var(--text-secondary)]">{item.label}</p>
              <p className="mono mt-1 text-lg font-semibold tracking-tight text-[color:var(--text-primary)]">
                {item.value}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] py-2">
        <div className="status-ticker flex w-max gap-2 pl-2">
          {tickerItems.map((item, index) => (
            <span
              key={`${item.label}-${index}`}
              className="mono inline-flex items-center rounded-lg border border-[color:rgba(21,26,23,0.08)] bg-white px-2 py-1 text-[10px] text-[color:var(--text-secondary)]"
            >
              {item.label}: {item.value}
            </span>
          ))}
        </div>
      </div>

      <div className="sr-only">
        {items.map((item) => (
          <article
            key={item.label}
            className="inline"
          >
            {item.label}: {item.value} {item.unit}
          </article>
        ))}
      </div>
    </section>
  );
}
