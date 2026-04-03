"use client";

import type { Metrics } from "@/lib/types";

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  if (Number.isNaN(value)) return "-";
  return String(Math.round(value * 100) / 100);
}

export function MetricsCards({ metrics }: { metrics: Metrics | null }) {
  const items = [
    { label: "Uptime (s)", value: metrics ? formatNumber(metrics.uptime_seconds) : "-" },
    { label: "WS Clients", value: metrics ? String(metrics.ws_clients) : "-" },
    {
      label: "Utterances",
      value: metrics ? String(metrics.utterances_total) : "-"
    },
    { label: "Emotion", value: metrics ? String(metrics.emotion_total) : "-" },
    {
      label: "Dropped",
      value: metrics ? String(metrics.emotion_dropped_total ?? 0) : "-"
    },
    {
      label: "Stale",
      value: metrics ? String(metrics.emotion_stale_total ?? 0) : "-"
    },
    {
      label: "Queue Depth",
      value: metrics ? String(metrics.emotion_queue_depth ?? 0) : "-"
    },
    { label: "Errors", value: metrics ? String(metrics.errors_total) : "-" },
    {
      label: "Avg Latency (ms)",
      value: metrics ? formatNumber(metrics.avg_emotion_latency_ms ?? null) : "-"
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-slate-800"
        >
          <div className="text-xs text-slate-400">{item.label}</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
