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
