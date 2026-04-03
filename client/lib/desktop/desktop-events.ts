import type { RuntimeEvent, RuntimeSnapshot } from "@ai-emotion/contracts";

import type {
  AsrFinalEvent,
  AsrPartialEvent,
  EmotionDroppedEvent,
  EmotionResultEvent,
  EventEnvelope,
  Metrics,
  SnapshotPayload,
  StatusResponse,
} from "@/lib/types";

const EMPTY_METRICS: Metrics = {
  uptime_seconds: 0,
  ws_clients: 0,
  utterances_total: 0,
  emotion_total: 0,
  errors_total: 0,
};

function envelope<TData extends EventEnvelope["data"]>(
  type: EventEnvelope["type"],
  data: TData,
): EventEnvelope {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: new Date().toISOString(),
    type,
    data,
  };
}

export function createStatusResponse(
  listening: boolean,
  metrics: Metrics,
  previous?: StatusResponse | null,
): StatusResponse {
  return {
    ...(previous ?? {}),
    status: { listening },
    metrics,
    last_error: previous?.last_error ?? null,
  };
}

export function mapRuntimeSnapshot(snapshot: RuntimeSnapshot): SnapshotPayload {
  return {
    status: createStatusResponse(snapshot.status.listening, snapshot.metrics),
    utterances: snapshot.utterances,
  };
}

export function mapRuntimeEventToEnvelopes(
  runtimeEvent: RuntimeEvent,
  previousStatus: StatusResponse | null,
): EventEnvelope[] {
  if (runtimeEvent.type === "runtime:snapshot") {
    return [envelope("snapshot", mapRuntimeSnapshot(runtimeEvent.payload))];
  }

  if (runtimeEvent.type === "session:status") {
    return [
      envelope(
        "status",
        createStatusResponse(
          runtimeEvent.payload.listening,
          previousStatus?.metrics ?? EMPTY_METRICS,
          previousStatus,
        ),
      ),
    ];
  }

  if (runtimeEvent.type === "runtime:metrics") {
    return [envelope("metrics", runtimeEvent.payload)];
  }

  if (runtimeEvent.type === "runtime:utterance") {
    const utterance = runtimeEvent.payload;
    const events: EventEnvelope[] = [];

    if (utterance.final_text) {
      const data: AsrFinalEvent = {
        utterance_id: utterance.id,
        started_at: utterance.started_at,
        ended_at: utterance.ended_at ?? utterance.started_at,
        final_text: utterance.final_text,
      };
      events.push(envelope("asr_final", data));
    }

    if (utterance.partial_text) {
      const data: AsrPartialEvent = {
        utterance_id: utterance.id,
        started_at: utterance.started_at,
        partial_text: utterance.partial_text,
        audio_level: 0,
      };
      events.push(envelope("asr_partial", data));
    }

    if (utterance.emotion_status === "processing") {
      events.push(envelope("emotion_start", { utterance_id: utterance.id }));
    }

    if (utterance.emotion_status === "done" && utterance.emotion) {
      const data: EmotionResultEvent = {
        utterance_id: utterance.id,
        emotion: utterance.emotion,
        latency_ms: utterance.latency_ms ?? 0,
      };
      events.push(envelope("emotion_result", data));
    }

    if (utterance.emotion_status === "dropped") {
      const data: EmotionDroppedEvent = {
        utterance_id: utterance.id,
        reason: "desktop-runtime",
      };
      events.push(envelope("emotion_dropped", data));
    }

    return events;
  }

  if (runtimeEvent.type === "emotion:started") {
    return [envelope("emotion_start", { utterance_id: runtimeEvent.payload.utteranceId })];
  }

  if (runtimeEvent.type === "emotion:result") {
    const data: EmotionResultEvent = {
      utterance_id: runtimeEvent.payload.utteranceId,
      emotion: runtimeEvent.payload.result,
      latency_ms: 0,
    };
    return [envelope("emotion_result", data)];
  }

  if (runtimeEvent.type === "runtime:error") {
    return [envelope("error", { message: runtimeEvent.payload.message })];
  }

  return [];
}
