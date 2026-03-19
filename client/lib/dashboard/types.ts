export const FRESHNESS_THRESHOLDS_MS = { live: 2000, stale: 8000 } as const;

export const PROVIDER_PANEL_STORAGE_KEY =
  "ai-emotion::dashboard::provider-panel-open::v1";

export const COMMAND_TIMEOUT_MS = 10_000;

export type Freshness = "LIVE" | "IDLE" | "STALE";

export type ErrorSource =
  | "ws_error_event"
  | "status_last_error"
  | "control_failure";
