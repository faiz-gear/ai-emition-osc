"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { AppShell } from "@/components/navigation/AppShell";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  COMMAND_TIMEOUT_MS,
  FRESHNESS_THRESHOLDS_MS,
  type Freshness,
} from "@/lib/dashboard/types";
import { createCommandTracker, withCommandTimeout } from "@/lib/dashboard/command-control";
import { getDesktopClient, type DesktopRuntimeClient } from "@/lib/desktop/desktop-client";
import { mapRuntimeEventToEnvelopes, mapRuntimeSnapshot } from "@/lib/desktop/desktop-events";
import {
  applyErrorEvent,
  deriveErrorVisibility,
  dismissError,
  type ErrorState,
} from "@/lib/dashboard/error-state";
import {
  normalizeAndSortUtterances,
  pickSelectedUtteranceId,
  upsertUtterance,
} from "@/lib/dashboard/utterance-utils";
import type {
  AsrFinalEvent,
  AsrPartialEvent,
  EmotionDroppedEvent,
  EmotionResultEvent,
  EmotionStartEvent,
  ErrorEvent,
  EventEnvelope,
  Metrics,
  SnapshotPayload,
  StatusResponse,
  Utterance,
} from "@/lib/types";
import type { ConnectionState } from "@/lib/useEventStream";

type DashboardState = {
  status: StatusResponse | null;
  metrics: Metrics | null;
  utterances: Utterance[];
  currentPartial: string;
  lastTranscriptUpdateMs: number | null;
};

type Action =
  | { type: "SNAPSHOT"; payload: SnapshotPayload }
  | { type: "STATUS"; payload: StatusResponse }
  | { type: "METRICS"; payload: Metrics }
  | { type: "ASR_PARTIAL"; payload: AsrPartialEvent }
  | { type: "ASR_FINAL"; payload: AsrFinalEvent }
  | { type: "EMOTION_START"; payload: EmotionStartEvent }
  | { type: "EMOTION_RESULT"; payload: EmotionResultEvent }
  | { type: "EMOTION_DROPPED"; payload: EmotionDroppedEvent };

const initialState: DashboardState = {
  status: null,
  metrics: null,
  utterances: [],
  currentPartial: "",
  lastTranscriptUpdateMs: null,
};

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case "SNAPSHOT": {
      const utterances = normalizeAndSortUtterances(action.payload.utterances ?? []);
      return {
        status: action.payload.status,
        metrics: action.payload.status.metrics,
        utterances,
        currentPartial: utterances[0]?.partial_text ?? "",
        lastTranscriptUpdateMs: utterances.length > 0 ? Date.now() : null,
      };
    }
    case "STATUS":
      return {
        ...state,
        status: action.payload,
        metrics: action.payload.metrics,
      };
    case "METRICS":
      return { ...state, metrics: action.payload };
    case "ASR_PARTIAL": {
      const utterances = normalizeAndSortUtterances(
        upsertUtterance(state.utterances, {
          id: action.payload.utterance_id,
          started_at: action.payload.started_at,
          partial_text: action.payload.partial_text,
          final_text: null,
          emotion_status: "queued",
        }),
      );
      return {
        ...state,
        utterances,
        currentPartial: action.payload.partial_text,
        lastTranscriptUpdateMs: Date.now(),
      };
    }
    case "ASR_FINAL": {
      const utterances = normalizeAndSortUtterances(
        upsertUtterance(state.utterances, {
          id: action.payload.utterance_id,
          started_at: action.payload.started_at,
          ended_at: action.payload.ended_at,
          final_text: action.payload.final_text,
          partial_text: null,
          emotion_status: "queued",
        }),
      );
      return {
        ...state,
        utterances,
        currentPartial: "",
        lastTranscriptUpdateMs: Date.now(),
      };
    }
    case "EMOTION_START": {
      const utterances = normalizeAndSortUtterances(
        upsertUtterance(state.utterances, {
          id: action.payload.utterance_id,
          emotion_status: "processing",
        }),
      );
      return { ...state, utterances };
    }
    case "EMOTION_RESULT": {
      const utterances = normalizeAndSortUtterances(
        upsertUtterance(state.utterances, {
          id: action.payload.utterance_id,
          emotion: action.payload.emotion,
          latency_ms: action.payload.latency_ms,
          emotion_status: "done",
        }),
      );
      return { ...state, utterances };
    }
    case "EMOTION_DROPPED": {
      const utterances = normalizeAndSortUtterances(
        upsertUtterance(state.utterances, {
          id: action.payload.utterance_id,
          emotion_status: "dropped",
        }),
      );
      return { ...state, utterances };
    }
    default:
      return state;
  }
}

function mapEventToAction(event: EventEnvelope): Action | null {
  if (event.type === "snapshot") {
    return { type: "SNAPSHOT", payload: event.data as SnapshotPayload };
  }
  if (event.type === "status") {
    return { type: "STATUS", payload: event.data as StatusResponse };
  }
  if (event.type === "metrics") {
    return { type: "METRICS", payload: event.data as Metrics };
  }
  if (event.type === "asr_partial") {
    return { type: "ASR_PARTIAL", payload: event.data as AsrPartialEvent };
  }
  if (event.type === "asr_final") {
    return { type: "ASR_FINAL", payload: event.data as AsrFinalEvent };
  }
  if (event.type === "emotion_start") {
    return { type: "EMOTION_START", payload: event.data as EmotionStartEvent };
  }
  if (event.type === "emotion_result") {
    return { type: "EMOTION_RESULT", payload: event.data as EmotionResultEvent };
  }
  if (event.type === "emotion_dropped") {
    return { type: "EMOTION_DROPPED", payload: event.data as EmotionDroppedEvent };
  }
  return null;
}

function deriveFreshness(lastUpdatedAt: number | null, nowMs: number): Freshness {
  if (!lastUpdatedAt) {
    return "STALE";
  }

  const delta = Math.max(0, nowMs - lastUpdatedAt);
  if (delta < FRESHNESS_THRESHOLDS_MS.live) {
    return "LIVE";
  }
  if (delta <= FRESHNESS_THRESHOLDS_MS.stale) {
    return "IDLE";
  }
  return "STALE";
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown-error";
}

export default function DashboardPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [followLatest, setFollowLatest] = useState(true);
  const [pendingCommand, setPendingCommand] = useState<"start" | "stop" | null>(
    null,
  );
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isMobile, setIsMobile] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  const desktopClientRef = useRef<DesktopRuntimeClient | null>(null);
  const commandTrackerRef = useRef(createCommandTracker());
  const latestStatusRef = useRef<StatusResponse | null>(null);
  const previousStatusErrorRef = useRef<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(media.matches);

    onChange();
    media.addEventListener("change", onChange);

    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const onEvent = useCallback((event: EventEnvelope) => {
    if (event.type === "error") {
      const payload = event.data as ErrorEvent;
      setErrorState((current) =>
        applyErrorEvent({
          current,
          source: "ws_error_event",
          message: payload.message,
        }),
      );
      return;
    }

    if (event.type === "snapshot") {
      latestStatusRef.current = (event.data as SnapshotPayload).status;
    } else if (event.type === "status") {
      latestStatusRef.current = event.data as StatusResponse;
    } else if (event.type === "metrics" && latestStatusRef.current) {
      latestStatusRef.current = {
        ...latestStatusRef.current,
        metrics: event.data as Metrics,
      };
    }

    const action = mapEventToAction(event);
    if (action) {
      dispatch(action);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let disposed = false;

    const bootstrap = async () => {
      try {
        const desktopClient = getDesktopClient();
        if (disposed) {
          return;
        }

        desktopClientRef.current = desktopClient;
        unsubscribe = desktopClient.subscribe((runtimeEvent) => {
          for (const mappedEvent of mapRuntimeEventToEnvelopes(
            runtimeEvent,
            latestStatusRef.current,
          )) {
            onEvent(mappedEvent);
          }
        });

        const snapshot = await desktopClient.getSnapshot();
        if (disposed) {
          return;
        }

        const mappedSnapshot = mapRuntimeSnapshot(snapshot);
        onEvent({
          id: "runtime-snapshot",
          ts: new Date().toISOString(),
          type: "snapshot",
          data: mappedSnapshot,
        });

        await desktopClient.startListening();
        setConnectionState("connected");
      } catch (error) {
        if (disposed) {
          return;
        }

        setConnectionState("disconnected");
        setErrorState((current) =>
          applyErrorEvent({
            current,
            source: "snapshot_fetch_failure",
            message: normalizeErrorMessage(error),
          }),
        );
      }
    };

    void bootstrap();

    return () => {
      disposed = true;
      desktopClientRef.current = null;
      unsubscribe?.();
    };
  }, [onEvent]);

  const runListeningCommand = useCallback(async (kind: "start" | "stop") => {
    const desktopClient = desktopClientRef.current;
    if (!desktopClient) {
      setErrorState((current) =>
        applyErrorEvent({
          current,
          source: "control_failure",
          message: "desktop api unavailable",
        }),
      );
      return;
    }

    const sequenceId = commandTrackerRef.current.next();
    setPendingCommand(kind);

    try {
      const snapshot = await withCommandTimeout(
        async () => {
          if (kind === "start") {
            await desktopClient.startListening();
          } else {
            await desktopClient.stopListening();
          }
          return await desktopClient.getSnapshot();
        },
        COMMAND_TIMEOUT_MS,
      );

      if (!commandTrackerRef.current.isLatest(sequenceId)) {
        return;
      }

      onEvent({
        id: `runtime-snapshot-${kind}`,
        ts: new Date().toISOString(),
        type: "snapshot",
        data: mapRuntimeSnapshot(snapshot),
      });
    } catch (error) {
      if (!commandTrackerRef.current.isLatest(sequenceId)) {
        return;
      }

      setErrorState((current) =>
        applyErrorEvent({
          current,
          source: "control_failure",
          message: normalizeErrorMessage(error),
        }),
      );
    } finally {
      if (commandTrackerRef.current.isLatest(sequenceId)) {
        setPendingCommand(null);
      }
    }
  }, [onEvent]);

  const startListening = useCallback(async () => {
    await runListeningCommand("start");
  }, [runListeningCommand]);

  const stopListening = useCallback(async () => {
    await runListeningCommand("stop");
  }, [runListeningCommand]);

  const latestStatusError = state.status?.last_error ?? null;

  useEffect(() => {
    if (latestStatusError && latestStatusError !== previousStatusErrorRef.current) {
      setErrorState((current) =>
        applyErrorEvent({
          current,
          source: "status_last_error",
          message: latestStatusError,
        }),
      );
    }

    previousStatusErrorRef.current = latestStatusError;
  }, [latestStatusError]);

  const utteranceIds = useMemo(
    () => state.utterances.map((utterance) => utterance.id),
    [state.utterances],
  );

  useEffect(() => {
    setSelectedId((previousSelectedId) =>
      pickSelectedUtteranceId({
        previousSelectedId,
        followLatest,
        utteranceIds,
      }),
    );
  }, [followLatest, utteranceIds]);

  const selectedUtterance = useMemo(() => {
    if (!selectedId) {
      return null;
    }

    return state.utterances.find((utterance) => utterance.id === selectedId) ?? null;
  }, [selectedId, state.utterances]);

  const latestUtterance = state.utterances[0] ?? null;

  const liveText =
    (state.currentPartial || latestUtterance?.final_text || latestUtterance?.partial_text || "").trim();

  const isProcessing =
    Boolean(state.currentPartial.trim()) || latestUtterance?.emotion_status === "processing";

  const freshness = deriveFreshness(state.lastTranscriptUpdateMs, nowMs);

  const visibleErrorMessage = useMemo(() => {
    if (!errorState) {
      return null;
    }

    const { visible } = deriveErrorVisibility({
      message: errorState.message,
      errorVersion: errorState.errorVersion,
      dismissedKey: errorState.dismissedKey,
    });

    return visible ? errorState.message : null;
  }, [errorState]);

  const dismissVisibleError = useCallback(() => {
    setErrorState((current) => {
      if (!current) {
        return current;
      }

      const dismissedKey = dismissError(current.visibleKey);
      const visibility = deriveErrorVisibility({
        message: current.message,
        errorVersion: current.errorVersion,
        dismissedKey,
      });

      return {
        ...current,
        dismissedKey,
        visible: visibility.visible,
        visibleKey: visibility.visibleKey,
      };
    });
  }, []);

  const listening = state.status?.status.listening ?? false;

  return (
    <AppShell activeTab="console">
      <DashboardShell
        connectionState={connectionState}
        listening={listening}
        isStarting={pendingCommand === "start"}
        isStopping={pendingCommand === "stop"}
        errorMessage={visibleErrorMessage}
        onStart={() => {
          void startListening();
        }}
        onStop={() => {
          void stopListening();
        }}
        onDismissError={dismissVisibleError}
        isMobile={isMobile}
        liveText={liveText}
        isProcessing={isProcessing}
        freshness={freshness}
        lastUpdatedAt={state.lastTranscriptUpdateMs}
        metrics={state.metrics}
        utterances={state.utterances}
        selectedId={selectedId}
        followLatest={followLatest}
        onSelectUtterance={(id) => {
          setFollowLatest(false);
          setSelectedId(id);
        }}
        onToggleFollow={setFollowLatest}
        selectedUtterance={selectedUtterance}
      />
    </AppShell>
  );
}
