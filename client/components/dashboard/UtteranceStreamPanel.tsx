import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useI18n } from "@/lib/i18n";
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

function formatTime(ts: string | null | undefined, locale: string) {
  if (!ts) {
    return "-";
  }

  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleTimeString(locale);
}

export function UtteranceStreamPanel({
  utterances,
  selectedId,
  followLatest,
  onSelect,
  onToggleFollow,
}: UtteranceStreamPanelProps) {
  const { locale, t } = useI18n();
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

  const statusLabel = (status: EmotionStatus) => {
    if (status === "done") {
      return t("emotionStatusDone");
    }
    if (status === "processing") {
      return t("emotionStatusProcessing");
    }
    if (status === "error") {
      return t("emotionStatusError");
    }
    if (status === "dropped") {
      return t("emotionStatusDropped");
    }
    return t("emotionStatusQueued");
  };

  return (
    <section className="dashboard-enter rounded-[2.25rem] border border-white/65 bg-[color:rgba(255,255,255,0.82)] p-6 shadow-[0_20px_40px_-28px_rgba(18,25,20,0.3),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
          {t("utteranceStream")}
        </p>
        <button
          type="button"
          onClick={() => onToggleFollow(!followLatest)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:-translate-y-[1px] ${
            followLatest
              ? "border-[color:rgba(15,118,110,0.35)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
              : "border-[color:var(--border)] bg-zinc-900/[0.04] text-[color:var(--text-secondary)]"
          }`}
        >
          {t("followLatest")}: {followLatest ? t("on") : t("off")}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {utterances.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
            <p className="text-sm text-[color:var(--text-secondary)]">{t("noUtterances")}</p>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
              {t("incomingSpeechHint")}
            </p>
          </div>
        ) : null}

        <motion.div
          layout
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: 0.08,
              },
            },
          }}
          className="space-y-2"
        >
          <AnimatePresence initial={false}>
            {utterances.map((utterance) => {
              const content = (utterance.final_text ?? "").trim() || t("emptyUtterance");
              const selected = selectedId === utterance.id;
              const expanded = expandedLookup.has(utterance.id);
              const canExpand = content.length > 96;

              return (
                <motion.article
                  layout
                  layoutId={`utterance-${utterance.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  key={utterance.id}
                  className={`rounded-3xl border p-3 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    selected
                      ? "border-[color:rgba(15,118,110,0.35)] bg-[color:var(--accent-soft)]"
                      : "border-[color:var(--border)] bg-[color:var(--surface-muted)]"
                  }`}
                >
                  <button
                    type="button"
                    aria-label={t("utteranceAria", { id: utterance.id })}
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
                        {formatTime(
                          utterance.ended_at ?? utterance.started_at,
                          locale === "zh" ? "zh-CN" : "en-US",
                        )}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(
                          utterance.emotion_status,
                        )}`}
                      >
                        {statusLabel(utterance.emotion_status)}
                      </span>
                    </div>

                    <p
                      className={`mt-2 text-sm leading-5 text-[color:var(--text-primary)] ${
                        expanded ? "" : "max-h-10 overflow-hidden"
                      }`}
                    >
                      {content}
                    </p>

                    {utterance.emotion?.dominant_emotion ? (
                      <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">
                        {t("dominant")}: {utterance.emotion.dominant_emotion}
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
                      aria-label={
                        expanded
                          ? t("collapseAria", { id: utterance.id })
                          : t("expandAria", { id: utterance.id })
                      }
                      className="mt-2 text-[11px] font-semibold text-[color:var(--accent)] hover:underline"
                    >
                      {expanded ? t("collapse") : t("expand")}
                    </button>
                  ) : null}
                </motion.article>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
