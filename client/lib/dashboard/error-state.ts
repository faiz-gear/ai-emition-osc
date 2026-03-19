import type { ErrorSource } from "./types";

export type ErrorState = {
  errorVersion: number;
  message: string;
  visible: boolean;
  visibleKey: string;
  dismissedKey: string | null;
  source: ErrorSource;
};

export type ApplyErrorEventInput = {
  current: ErrorState | null;
  source: ErrorSource;
  message: string | null;
};

function normalizeErrorMessage(message: string | null): string {
  return (message ?? "").trim() || "unknown-error";
}

export function buildErrorSignature(message: string | null, version: number): string {
  return `${normalizeErrorMessage(message)}|${version}`;
}

export function deriveErrorVisibility(input: {
  message: string | null;
  errorVersion: number;
  dismissedKey: string | null;
}): { visible: boolean; visibleKey: string } {
  const visibleKey = buildErrorSignature(input.message, input.errorVersion);
  return {
    visible: input.dismissedKey !== visibleKey,
    visibleKey,
  };
}

export function applyErrorEvent(input: ApplyErrorEventInput): ErrorState {
  const errorVersion = (input.current?.errorVersion ?? 0) + 1;
  const message = normalizeErrorMessage(input.message);
  const { visible, visibleKey } = deriveErrorVisibility({
    message,
    errorVersion,
    dismissedKey: null,
  });

  return {
    errorVersion,
    message,
    visible,
    visibleKey,
    dismissedKey: null,
    source: input.source,
  };
}

export function applyRefresh(input: { message: string | null }): ErrorState {
  const message = normalizeErrorMessage(input.message);
  const errorVersion = 1;
  const visibleKey = buildErrorSignature(message, errorVersion);

  return {
    errorVersion,
    message,
    visible: true,
    visibleKey,
    dismissedKey: null,
    source: "status_last_error",
  };
}

export function dismissError(signature: string): string {
  return signature;
}
