"use client";

import React, { useMemo, useState } from "react";

import type { ConnectionState } from "@/lib/useEventStream";

type ControlRailProps = {
  isMobile?: boolean;
  connectionState: ConnectionState;
  listening: boolean;
  isStarting: boolean;
  isStopping: boolean;
  hasError: boolean;
  errorMessage: string | null;
  onStart: () => void;
  onStop: () => void;
  onDismissError: () => void;
};

function connectionLabel(state: ConnectionState) {
  if (state === "connected") {
    return "Connected";
  }

  if (state === "connecting") {
    return "Connecting";
  }

  return "Disconnected";
}

function connectionClass(state: ConnectionState) {
  if (state === "connected") {
    return "bg-[color:rgba(31,157,85,0.12)] text-[color:var(--success)] border-[color:rgba(31,157,85,0.4)]";
  }

  if (state === "connecting") {
    return "bg-[color:rgba(183,121,31,0.12)] text-[color:var(--warning)] border-[color:rgba(183,121,31,0.4)]";
  }

  return "bg-[color:rgba(197,48,48,0.12)] text-[color:var(--danger)] border-[color:rgba(197,48,48,0.4)]";
}

function listeningClass(listening: boolean) {
  if (listening) {
    return "bg-[color:rgba(94,106,210,0.12)] text-[color:var(--accent)] border-[color:rgba(94,106,210,0.35)]";
  }

  return "bg-[color:rgba(17,19,24,0.06)] text-[color:var(--text-secondary)] border-[color:var(--border)]";
}

export function ControlRail({
  isMobile = false,
  connectionState,
  listening,
  isStarting,
  isStopping,
  hasError,
  errorMessage,
  onStart,
  onStop,
  onDismissError,
}: ControlRailProps) {
  const [isErrorSheetOpen, setIsErrorSheetOpen] = useState(false);

  const controlsLocked = isStarting || isStopping;

  const canShowError = hasError && Boolean(errorMessage?.trim());

  const normalizedError = useMemo(
    () => (errorMessage ?? "").trim() || "unknown-error",
    [errorMessage],
  );

  return (
    <section className="sticky top-0 z-30 rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:rgba(255,255,255,0.92)] p-[var(--space-3)] shadow-[0_8px_22px_rgba(17,19,24,0.06)] backdrop-blur">
      <div className="flex items-center gap-[var(--space-2)] overflow-x-auto">
        <button
          type="button"
          onClick={onStart}
          disabled={controlsLocked || listening}
          className="rounded-md border border-[color:rgba(94,106,210,0.4)] bg-[color:rgba(94,106,210,0.12)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)] transition hover:bg-[color:rgba(94,106,210,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStarting ? "Starting..." : "Start"}
        </button>

        <button
          type="button"
          onClick={onStop}
          disabled={controlsLocked || !listening}
          className="rounded-md border border-[color:rgba(197,48,48,0.35)] bg-[color:rgba(197,48,48,0.1)] px-3 py-1.5 text-xs font-semibold text-[color:var(--danger)] transition hover:bg-[color:rgba(197,48,48,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStopping ? "Stopping..." : "Stop"}
        </button>

        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] font-medium ${connectionClass(
            connectionState,
          )}`}
        >
          {connectionLabel(connectionState)}
        </span>

        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] font-medium ${listeningClass(
            listening,
          )}`}
        >
          {listening ? "Listening" : "Stopped"}
        </span>

        {canShowError && isMobile ? (
          <button
            type="button"
            onClick={() => setIsErrorSheetOpen(true)}
            className="ml-auto inline-flex items-center rounded-full border border-[color:rgba(197,48,48,0.35)] bg-[color:rgba(197,48,48,0.08)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--danger)]"
            aria-label="Show error details"
          >
            Error
          </button>
        ) : null}

        {canShowError && !isMobile ? (
          <div className="ml-auto flex min-w-0 items-center gap-2 rounded-md border border-[color:rgba(197,48,48,0.3)] bg-[color:rgba(197,48,48,0.08)] px-2 py-1">
            <p className="truncate text-xs text-[color:var(--danger)]">{normalizedError}</p>
            <button
              type="button"
              onClick={onDismissError}
              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[color:var(--danger)] hover:bg-[color:rgba(197,48,48,0.12)]"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>

      {isMobile && isErrorSheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[0_-8px_30px_rgba(17,19,24,0.2)]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Last Error
          </p>
          <p className="mt-2 text-sm text-[color:var(--danger)]">{normalizedError}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsErrorSheetOpen(false)}
              className="rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onDismissError();
                setIsErrorSheetOpen(false);
              }}
              className="rounded-md border border-[color:rgba(197,48,48,0.35)] bg-[color:rgba(197,48,48,0.08)] px-3 py-1.5 text-xs font-semibold text-[color:var(--danger)]"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
