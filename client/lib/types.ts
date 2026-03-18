export type EmotionDimensions = {
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;
};

export type EmotionResult = {
  dimensions: EmotionDimensions;
  dominant_emotion: string;
  brief_explanation: string;
};

export type EmotionStatus = "queued" | "processing" | "done" | "dropped" | "error";

export type Utterance = {
  id: string;
  started_at: string;
  ended_at?: string | null;
  partial_text?: string | null;
  final_text?: string | null;
  emotion?: EmotionResult | null;
  emotion_status: EmotionStatus;
  latency_ms?: number | null;
};

export type Metrics = {
  uptime_seconds: number;
  ws_clients: number;
  utterances_total: number;
  emotion_total: number;
  emotion_dropped_total?: number;
  emotion_stale_total?: number;
  emotion_queue_depth?: number;
  errors_total: number;
  avg_emotion_latency_ms?: number | null;
};

export type StatusResponse = {
  status: { listening: boolean };
  metrics: Metrics;
  config: {
    vosk_model_path: string;
    sample_rate: number;
    llm_model: string;
    active_provider?: string | null;
    active_model?: string | null;
    osc_target: string;
    event_buffer_size: number;
    emotion_queue_policy?: string;
    emotion_queue_maxsize?: number;
  };
  last_error?: string | null;
};

export type SnapshotPayload = {
  status: StatusResponse;
  utterances: Utterance[];
};

export type EventType =
  | "snapshot"
  | "status"
  | "asr_partial"
  | "asr_final"
  | "emotion_start"
  | "emotion_result"
  | "emotion_dropped"
  | "metrics"
  | "error";

export type EventEnvelope = {
  id: string;
  ts: string;
  type: EventType;
  data: unknown;
};

export type AsrPartialEvent = {
  utterance_id: string;
  started_at: string;
  partial_text: string;
  audio_level: number;
};

export type AsrFinalEvent = {
  utterance_id: string;
  started_at: string;
  ended_at: string;
  final_text: string;
};

export type EmotionStartEvent = { utterance_id: string };

export type EmotionResultEvent = {
  utterance_id: string;
  emotion: EmotionResult;
  latency_ms: number;
};

export type EmotionDroppedEvent = {
  utterance_id: string;
  reason: string;
};

export type ErrorEvent = { message: string; utterance_id?: string | null };

export type ProviderType = "ollama" | "openai" | "openai_compatible";

export type ProviderSummary = {
  id: string;
  name: string;
  provider_type: ProviderType;
  provider_key?: string | null;
  model: string;
  base_url?: string | null;
  temperature?: number | null;
  is_active: boolean;
  updated_at: string;
  has_api_key?: boolean | null;
  headers_keys?: string[] | null;
  status: "ok" | "degraded";
  error_code?: string | null;
  error_message?: string | null;
};

export type ProviderTestResult = {
  ok: boolean;
  latency_ms: number;
};

export type ProviderErrorResponse = {
  code: string;
  message: string;
  details: Record<string, unknown>;
};

export type CreateProviderRequest = {
  name: string;
  provider_type: ProviderType;
  provider_key?: string | null;
  model: string;
  base_url?: string | null;
  temperature?: number | null;
  api_key?: string | null;
  headers?: Record<string, string> | null;
};

export type PatchProviderRequest = Partial<CreateProviderRequest>;
