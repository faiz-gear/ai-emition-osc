import React, { useMemo, useState } from "react";

import type { EmotionStatus, Utterance } from "@/lib/types";

type UtteranceStreamPanelProps = {
  utterances: Utterance[];
  selectedId: string | null;
  followLatest: boolean;
  onSelect: (id: string) => void;
  onToggleFollow: (next: boolean) => void;
};

function statusClass(status: EmotionStatus) {
  if (status === "done") {
    return "bg-[color:rgba(31,157,85,0.12)] text-[color:var(--success)] border-[color:rgba(31,157,85,0.4)]";
  }

  if (status === "processing") {
    return "bg-[color:rgba(183,121,31,0.12)] text-[color:var(--warning)] border-[color:rgba(183,121,31,0.4)]";
  }

  if (status === "error") {
    return "bg-[color:rgba(197,48,48,0.12)] text-[color:var(--danger)] border-[color:rgba(197,48,48,0.35)]";
  }

  if (status === "dropped") {
    return "bg-[color:rgba(95,100,112,0.12)] text-[color:var(--text-secondary)] border-[color:rgba(95,100,112,0.35)]";
  }

  return "bg-[color:rgba(17,19,24,0.06)] text-[color:var(--text-secondary)] border-[color:var(--border)]";
}

function formatTime(ts: string | null | undefined) {
  if (!ts) {
    return "-";
  }

  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString();
}

export function UtteranceStreamPanel({
  utterances,
  selectedId,
  followLatest,
  onSelect,
  onToggleFollow,
}: UtteranceStreamPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const expandedLookup = useMemo(() => expandedIds, [expandedIds]);

  const onToggleExpanded = (id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="dashboard-enter rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-[var(--space-3)] shadow-[0_8px_22px_rgba(17,19,24,0.05)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Utterance Stream
        </p>
        <button
          type="button"
          onClick={() => onToggleFollow(!followLatest)}
          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
            followLatest
              ? "border-[color:rgba(94,106,210,0.35)] bg-[color:rgba(94,106,210,0.12)] text-[color:var(--accent)]"
              : "border-[color:var(--border)] bg-[color:rgba(17,19,24,0.06)] text-[color:var(--text-secondary)]"
          }`}
        >
          Follow latest: {followLatest ? "On" : "Off"}
        </button>
      </div>

      <div className="mt-2 space-y-2">
        {utterances.length === 0 ? (
          <p className="rounded-md border border-dashed border-[color:var(--border)] p-3 text-sm text-[color:var(--text-secondary)]">
            No utterances yet.
          </p>
        ) : null}

        {utterances.map((utterance) => {
          const content =
            (utterance.final_text ?? utterance.partial_text ?? "").trim() || "(empty)";
          const selected = selectedId === utterance.id;
          const expanded = expandedLookup.has(utterance.id);
          const canExpand = content.length > 96;

          return (
            <article
              key={utterance.id}
              className={`rounded-md border p-2 transition ${
                selected
                  ? "border-[color:rgba(94,106,210,0.45)] bg-[color:rgba(94,106,210,0.08)]"
                  : "border-[color:var(--border)] bg-[color:var(--surface-muted)]"
              }`}
            >
              <button
                type="button"
                aria-label={`Utterance ${utterance.id}`}
                className="w-full text-left"
                onClick={() => {
                  if (followLatest) {
                    onToggleFollow(false);
                  }
                  onSelect(utterance.id);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="mono text-[11px] text-[color:var(--text-secondary)]">
                    {formatTime(utterance.ended_at ?? utterance.started_at)}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(
                      utterance.emotion_status,
                    )}`}
                  >
                    {utterance.emotion_status}
                  </span>
                </div>

                <p
                  className={`mt-1 text-sm leading-5 text-[color:var(--text-primary)] ${
                    expanded ? "" : "max-h-10 overflow-hidden"
                  }`}
                >
                  {content}
                </p>

                {utterance.emotion?.dominant_emotion ? (
                  <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
                    Dominant: {utterance.emotion.dominant_emotion}
                    {utterance.latency_ms ? (
                      <span className="mono ml-1">{Math.round(utterance.latency_ms)}ms</span>
                    ) : null}
                  </p>
                ) : null}
              </button>

              {canExpand ? (
                <button
                  type="button"
                  onClick={() => onToggleExpanded(utterance.id)}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${utterance.id}`}
                  className="mt-1 text-[11px] font-semibold text-[color:var(--accent)] hover:underline"
                >
                  {expanded ? "Collapse" : "Expand"}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
