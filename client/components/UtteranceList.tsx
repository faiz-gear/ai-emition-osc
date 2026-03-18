"use client";

import type { EmotionStatus, Utterance } from "@/lib/types";

function statusColor(status: EmotionStatus) {
  if (status === "done") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
  if (status === "processing") return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
  if (status === "dropped") return "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30";
  if (status === "error") return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
  return "bg-slate-500/10 text-slate-300 ring-slate-500/25";
}

function formatTime(ts: string | undefined | null) {
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString();
}

export function UtteranceList({
  utterances,
  selectedId,
  onSelect
}: {
  utterances: Utterance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {utterances.length === 0 ? (
        <div className="rounded-xl bg-slate-900/60 p-4 text-sm text-slate-400 ring-1 ring-slate-800">
          暂无记录。开始说话后这里会出现识别与情绪分析结果。
        </div>
      ) : null}

      {utterances.map((u) => {
        const text = u.final_text ?? u.partial_text ?? "";
        const isSelected = selectedId === u.id;
        return (
          <button
            key={u.id}
            onClick={() => onSelect(u.id)}
            className={[
              "w-full rounded-xl bg-slate-900/60 p-3 text-left ring-1 ring-slate-800 transition",
              isSelected ? "ring-sky-500/50" : "hover:ring-slate-700"
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-slate-400">
                {formatTime(u.ended_at ?? u.started_at)}
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] ring-1 ${statusColor(
                  u.emotion_status
                )}`}
              >
                {u.emotion_status}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-100">
              {text || <span className="text-slate-500">（空）</span>}
            </div>
            {u.emotion?.dominant_emotion ? (
              <div className="mt-1 text-xs text-slate-400">
                dominant: {u.emotion.dominant_emotion}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
