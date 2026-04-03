"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle,
  RadioButton,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

import { MagneticButton } from "@/components/dashboard/MagneticButton";
import { StatusPulse } from "@/components/dashboard/StatusPulse";
import { useI18n } from "@/lib/i18n";
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

function connectionLabel(state: ConnectionState, t: ReturnType<typeof useI18n>["t"]) {
  if (state === "connected") {
    return t("connected");
  }

  if (state === "connecting") {
    return t("connecting");
  }

  return t("disconnected");
}

function connectionClass(state: ConnectionState) {
  if (state === "connected") {
    return "bg-emerald-500/10 text-[color:var(--success)] border-emerald-500/30";
  }

  if (state === "connecting") {
    return "bg-amber-500/10 text-[color:var(--warning)] border-amber-500/30";
  }

  return "bg-rose-500/10 text-[color:var(--danger)] border-rose-500/30";
}

function connectionTone(state: ConnectionState): "success" | "warning" | "danger" {
  if (state === "connected") {
    return "success";
  }
  if (state === "connecting") {
    return "warning";
  }
  return "danger";
}

function listeningClass(listening: boolean) {
  if (listening) {
    return "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-[color:rgba(15,118,110,0.35)]";
  }

  return "bg-zinc-900/[0.04] text-[color:var(--text-secondary)] border-[color:var(--border)]";
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
  const { t } = useI18n();
  const [isErrorSheetOpen, setIsErrorSheetOpen] = useState(false);

  const controlsLocked = isStarting || isStopping;

  const canShowError = hasError && Boolean(errorMessage?.trim());

  const normalizedError = useMemo(
    () => (errorMessage ?? "").trim() || t("unknownError"),
    [errorMessage, t],
  );

  const connectionToneValue = connectionTone(connectionState);

  return (
    <section className="dashboard-enter sticky top-4 z-20 rounded-[2rem] border border-white/60 bg-white/85 p-4 shadow-[0_18px_45px_-32px_rgba(22,30,24,0.42),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md">
      <div className="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <MagneticButton
            type="button"
            onClick={onStart}
            disabled={controlsLocked || listening}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[color:rgba(15,118,110,0.35)] bg-[color:var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle size={15} weight="duotone" />
            {isStarting ? t("starting") : t("start")}
          </MagneticButton>

          <MagneticButton
            type="button"
            onClick={onStop}
            disabled={controlsLocked || !listening}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--danger)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle size={15} weight="duotone" />
            {isStopping ? t("stopping") : t("stop")}
          </MagneticButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${connectionClass(
              connectionState,
            )}`}
          >
            <StatusPulse tone={connectionToneValue} />
            {connectionLabel(connectionState, t)}
          </span>

          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${listeningClass(
              listening,
            )}`}
          >
            <RadioButton size={13} weight="duotone" />
            {listening ? t("listening") : t("stopped")}
          </span>

          {canShowError && isMobile ? (
            <MagneticButton
              type="button"
              onClick={() => setIsErrorSheetOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--danger)] active:-translate-y-[1px]"
              aria-label={t("showErrorDetails")}
            >
              <WarningCircle size={13} weight="duotone" />
              {t("error")}
            </MagneticButton>
          ) : null}

          {canShowError && !isMobile ? (
            <div className="ml-auto flex min-w-0 items-center gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-2 py-1.5">
              <p className="truncate text-xs text-[color:var(--danger)]">{normalizedError}</p>
              <MagneticButton
                type="button"
                onClick={onDismissError}
                className="rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-[color:var(--danger)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-rose-500/15 active:-translate-y-[1px]"
              >
                {t("dismiss")}
              </MagneticButton>
            </div>
          ) : null}
        </div>
      </div>

      {isMobile && isErrorSheetOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-x-0 bottom-0 z-30 rounded-t-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[0_-12px_30px_rgba(21,26,23,0.22)]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            {t("lastError")}
          </p>
          <p className="mt-2 text-sm text-[color:var(--danger)]">{normalizedError}</p>
          <div className="mt-3 flex justify-end gap-2">
            <MagneticButton
              type="button"
              onClick={() => setIsErrorSheetOpen(false)}
              className="rounded-xl border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)] active:-translate-y-[1px]"
            >
              {t("close")}
            </MagneticButton>
            <MagneticButton
              type="button"
              onClick={() => {
                onDismissError();
                setIsErrorSheetOpen(false);
              }}
              className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--danger)] active:-translate-y-[1px]"
            >
              {t("dismiss")}
            </MagneticButton>
          </div>
        </div>
      ) : null}
    </section>
  );
}
