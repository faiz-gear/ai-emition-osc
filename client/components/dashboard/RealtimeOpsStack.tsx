import React from "react";

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
  const items = [
    { label: "Latency", value: formatValue(metrics?.avg_emotion_latency_ms), unit: "ms" },
    { label: "Queue", value: String(metrics?.emotion_queue_depth ?? 0), unit: "count" },
    { label: "Utterances", value: String(metrics?.utterances_total ?? 0), unit: "total" },
    { label: "Emotion", value: String(metrics?.emotion_total ?? 0), unit: "total" },
    { label: "Errors", value: String(metrics?.errors_total ?? 0), unit: "total" },
    { label: "WS", value: String(metrics?.ws_clients ?? 0), unit: "clients" },
  ];

  return (
    <section className="dashboard-enter rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-[var(--space-3)] shadow-[0_8px_22px_rgba(17,19,24,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
        Realtime Ops
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.label}
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-2"
          >
            <p className="text-[11px] text-[color:var(--text-secondary)]">{item.label}</p>
            <p className="mono mt-1 text-base font-semibold text-[color:var(--text-primary)]">
              {item.value}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-[color:var(--text-secondary)]">
              {item.unit}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
