"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { ConnectionBadge } from "@/components/ConnectionBadge";
import { EmotionRadar } from "@/components/EmotionRadar";
import { MetricsCards } from "@/components/MetricsCards";
import { UtteranceList } from "@/components/UtteranceList";
import { API_BASE, WS_URL } from "@/lib/config";
import { useEventStream } from "@/lib/useEventStream";
import type {
  AsrFinalEvent,
  AsrPartialEvent,
  EmotionResult,
  EmotionResultEvent,
  EmotionStartEvent,
  ErrorEvent,
  EventEnvelope,
  Metrics,
  SnapshotPayload,
  StatusResponse,
  Utterance
} from "@/lib/types";

type DashboardState = {
  status: StatusResponse | null;
  metrics: Metrics | null;
  utterances: Utterance[];
  currentPartial: string;
  lastError: string | null;
};

type Action =
  | { type: "SNAPSHOT"; payload: SnapshotPayload }
  | { type: "STATUS"; payload: StatusResponse }
  | { type: "METRICS"; payload: Metrics }
  | { type: "ASR_PARTIAL"; payload: AsrPartialEvent }
  | { type: "ASR_FINAL"; payload: AsrFinalEvent }
  | { type: "EMOTION_START"; payload: EmotionStartEvent }
  | { type: "EMOTION_RESULT"; payload: EmotionResultEvent }
  | { type: "ERROR"; payload: ErrorEvent };

const initialState: DashboardState = {
  status: null,
  metrics: null,
  utterances: [],
  currentPartial: "",
  lastError: null
};

function upsertUtterance(list: Utterance[], patch: Partial<Utterance> & { id: string }) {
  const index = list.findIndex((u) => u.id === patch.id);
  if (index === -1) {
    const nowIso = new Date().toISOString();
    const created: Utterance = {
      id: patch.id,
      started_at: patch.started_at ?? nowIso,
      ended_at: patch.ended_at ?? null,
      partial_text: patch.partial_text ?? null,
      final_text: patch.final_text ?? null,
      emotion: patch.emotion ?? null,
      emotion_status: patch.emotion_status ?? "queued",
      latency_ms: patch.latency_ms ?? null
    };
    return [created, ...list];
  }

  const next = [...list];
  next[index] = { ...next[index], ...patch };
  return next;
}

function sortUtterances(list: Utterance[]) {
  return [...list].sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
}

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "SNAPSHOT": {
      const utterances = sortUtterances(action.payload.utterances ?? []);
      return {
        status: action.payload.status,
        metrics: action.payload.status.metrics,
        utterances,
        currentPartial: utterances[0]?.partial_text ?? "",
        lastError: action.payload.status.last_error ?? null
      };
    }
    case "STATUS":
      return {
        ...state,
        status: action.payload,
        metrics: action.payload.metrics,
        lastError: action.payload.last_error ?? state.lastError
      };
    case "METRICS":
      return { ...state, metrics: action.payload };
    case "ASR_PARTIAL": {
      const utterances = upsertUtterance(state.utterances, {
        id: action.payload.utterance_id,
        started_at: action.payload.started_at,
        partial_text: action.payload.partial_text,
        final_text: null,
        emotion_status: "queued"
      });
      return { ...state, utterances, currentPartial: action.payload.partial_text };
    }
    case "ASR_FINAL": {
      const utterances = upsertUtterance(state.utterances, {
        id: action.payload.utterance_id,
        started_at: action.payload.started_at,
        ended_at: action.payload.ended_at,
        final_text: action.payload.final_text,
        partial_text: null,
        emotion_status: "queued"
      });
      return { ...state, utterances, currentPartial: "" };
    }
    case "EMOTION_START": {
      const utterances = upsertUtterance(state.utterances, {
        id: action.payload.utterance_id,
        emotion_status: "processing"
      });
      return { ...state, utterances };
    }
    case "EMOTION_RESULT": {
      const utterances = upsertUtterance(state.utterances, {
        id: action.payload.utterance_id,
        emotion: action.payload.emotion,
        latency_ms: action.payload.latency_ms,
        emotion_status: "done"
      });
      return { ...state, utterances };
    }
    case "ERROR":
      return { ...state, lastError: action.payload.message };
    default:
      return state;
  }
}

function parseEvent(event: EventEnvelope, dispatch: (action: Action) => void) {
  if (event.type === "snapshot")
    return dispatch({ type: "SNAPSHOT", payload: event.data as SnapshotPayload });
  if (event.type === "status")
    return dispatch({ type: "STATUS", payload: event.data as StatusResponse });
  if (event.type === "metrics")
    return dispatch({ type: "METRICS", payload: event.data as Metrics });
  if (event.type === "asr_partial")
    return dispatch({ type: "ASR_PARTIAL", payload: event.data as AsrPartialEvent });
  if (event.type === "asr_final")
    return dispatch({ type: "ASR_FINAL", payload: event.data as AsrFinalEvent });
  if (event.type === "emotion_start")
    return dispatch({
      type: "EMOTION_START",
      payload: event.data as EmotionStartEvent
    });
  if (event.type === "emotion_result")
    return dispatch({
      type: "EMOTION_RESULT",
      payload: event.data as EmotionResultEvent
    });
  if (event.type === "error")
    return dispatch({ type: "ERROR", payload: event.data as ErrorEvent });
}

async function postJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return (await response.json()) as StatusResponse;
}

export default function DashboardPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const onEvent = useCallback((event: EventEnvelope) => {
    parseEvent(event, dispatch);
  }, []);

  const { connectionState } = useEventStream(WS_URL, onEvent);

  const listening = state.status?.status.listening ?? false;

  const selectedUtterance = useMemo(() => {
    if (selectedId) return state.utterances.find((u) => u.id === selectedId) ?? null;
    return state.utterances[0] ?? null;
  }, [selectedId, state.utterances]);

  const selectedEmotion: EmotionResult | null = selectedUtterance?.emotion ?? null;

  const startListening = useCallback(async () => {
    setIsStarting(true);
    try {
      const status = await postJson("/api/listening/start");
      dispatch({ type: "STATUS", payload: status });
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stopListening = useCallback(async () => {
    setIsStopping(true);
    try {
      const status = await postJson("/api/listening/stop");
      dispatch({ type: "STATUS", payload: status });
    } finally {
      setIsStopping(false);
    }
  }, []);

  useEffect(() => {
    // One-click UX: try start listening once.
    void startListening().catch(() => {});
  }, [startListening]);

  useEffect(() => {
    if (selectedId) return;
    if (state.utterances.length > 0) setSelectedId(state.utterances[0].id);
  }, [selectedId, state.utterances]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            语音情绪识别监控台
          </h1>
          <div className="mt-1 text-sm text-slate-400">
            可视化、跟踪与监控：ASR + Emotion + Metrics
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ConnectionBadge connectionState={connectionState} />
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs ring-1 ${
              listening
                ? "bg-sky-500/15 text-sky-300 ring-sky-500/30"
                : "bg-slate-500/10 text-slate-300 ring-slate-500/25"
            }`}
          >
            {listening ? "Listening" : "Stopped"}
          </span>

          <button
            onClick={startListening}
            disabled={isStarting || listening}
            className="rounded-lg bg-sky-500/20 px-3 py-2 text-sm text-sky-200 ring-1 ring-sky-500/30 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarting ? "Starting..." : "Start"}
          </button>
          <button
            onClick={stopListening}
            disabled={isStopping || !listening}
            className="rounded-lg bg-rose-500/20 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-500/30 transition hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStopping ? "Stopping..." : "Stop"}
          </button>
        </div>
      </header>

      {state.lastError ? (
        <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200 ring-1 ring-rose-500/20">
          {state.lastError}
        </div>
      ) : null}

      <MetricsCards metrics={state.metrics} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
            <div className="text-xs text-slate-400">Realtime Subtitle</div>
            <div className="mt-2 min-h-10 text-sm text-slate-100">
              {state.currentPartial ? (
                state.currentPartial
              ) : (
                <span className="text-slate-500">（等待语音输入…）</span>
              )}
            </div>
          </div>

          <UtteranceList
            utterances={state.utterances}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">Emotion (Plutchik)</div>
              <div className="mt-1 text-sm text-slate-100">
                dominant:{" "}
                <span className="font-semibold text-sky-200">
                  {selectedEmotion?.dominant_emotion ?? "—"}
                </span>
                {selectedUtterance?.latency_ms ? (
                  <span className="ml-2 text-xs text-slate-400">
                    {Math.round(selectedUtterance.latency_ms)}ms
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {selectedEmotion?.brief_explanation ?? "—"}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <EmotionRadar emotion={selectedEmotion} />
          </div>
        </section>
      </div>

      <footer className="text-xs text-slate-500">
        API: {API_BASE} · WS: {WS_URL}
      </footer>
    </main>
  );
}
