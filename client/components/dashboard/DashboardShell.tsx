import React from "react";

import { ControlRail } from "@/components/dashboard/ControlRail";
import { EmotionDetailPanel } from "@/components/dashboard/EmotionDetailPanel";
import { LiveTranscriptStage } from "@/components/dashboard/LiveTranscriptStage";
import { RealtimeOpsStack } from "@/components/dashboard/RealtimeOpsStack";
import { UtteranceStreamPanel } from "@/components/dashboard/UtteranceStreamPanel";
import type { Freshness } from "@/lib/dashboard/types";
import { useI18n } from "@/lib/i18n";
import type { ConnectionState } from "@/lib/useEventStream";
import type { Metrics, Utterance } from "@/lib/types";

type DashboardShellProps = {
  connectionState: ConnectionState;
  listening: boolean;
  isStarting: boolean;
  isStopping: boolean;
  errorMessage: string | null;
  onStart: () => void;
  onStop: () => void;
  onDismissError: () => void;
  isMobile: boolean;
  liveText: string;
  isProcessing: boolean;
  freshness: Freshness;
  lastUpdatedAt: number | null;
  metrics: Metrics | null;
  utterances: Utterance[];
  selectedId: string | null;
  followLatest: boolean;
  onSelectUtterance: (id: string) => void;
  onToggleFollow: (next: boolean) => void;
  selectedUtterance: Utterance | null;
};

export function DashboardShell({
  connectionState,
  listening,
  isStarting,
  isStopping,
  errorMessage,
  onStart,
  onStop,
  onDismissError,
  isMobile,
  liveText,
  isProcessing,
  freshness,
  lastUpdatedAt,
  metrics,
  utterances,
  selectedId,
  followLatest,
  onSelectUtterance,
  onToggleFollow,
  selectedUtterance,
}: DashboardShellProps) {
  return (
    <DashboardShellContent
      connectionState={connectionState}
      listening={listening}
      isStarting={isStarting}
      isStopping={isStopping}
      errorMessage={errorMessage}
      onStart={onStart}
      onStop={onStop}
      onDismissError={onDismissError}
      isMobile={isMobile}
      liveText={liveText}
      isProcessing={isProcessing}
      freshness={freshness}
      lastUpdatedAt={lastUpdatedAt}
      metrics={metrics}
      utterances={utterances}
      selectedId={selectedId}
      followLatest={followLatest}
      onSelectUtterance={onSelectUtterance}
      onToggleFollow={onToggleFollow}
      selectedUtterance={selectedUtterance}
    />
  );
}

function DashboardShellContent({
  connectionState,
  listening,
  isStarting,
  isStopping,
  errorMessage,
  onStart,
  onStop,
  onDismissError,
  isMobile,
  liveText,
  isProcessing,
  freshness,
  lastUpdatedAt,
  metrics,
  utterances,
  selectedId,
  followLatest,
  onSelectUtterance,
  onToggleFollow,
  selectedUtterance,
}: DashboardShellProps) {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px] flex-col gap-5 px-4 py-6 md:px-6 md:py-7">
      <header className="dashboard-enter rounded-[2.25rem] border border-white/60 bg-white/70 p-5 shadow-[0_24px_55px_-35px_rgba(20,30,20,0.45),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--text-secondary)]">
            {t("dashboardEyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)] md:text-4xl">
            {t("dashboardTitle")}
          </h1>
          <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-[color:var(--text-secondary)]">
            {t("dashboardDescription")}
          </p>
        </div>
      </header>

      <ControlRail
        isMobile={isMobile}
        connectionState={connectionState}
        listening={listening}
        isStarting={isStarting}
        isStopping={isStopping}
        hasError={Boolean(errorMessage)}
        errorMessage={errorMessage}
        onStart={onStart}
        onStop={onStop}
        onDismissError={onDismissError}
      />

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="grid gap-5">
          <LiveTranscriptStage
            text={liveText}
            isProcessing={isProcessing}
            freshness={freshness}
            lastUpdatedAt={lastUpdatedAt}
          />
          <UtteranceStreamPanel
            utterances={utterances}
            selectedId={selectedId}
            followLatest={followLatest}
            onSelect={onSelectUtterance}
            onToggleFollow={onToggleFollow}
          />
        </div>
        <div className="grid gap-5">
          <RealtimeOpsStack metrics={metrics} />
          <EmotionDetailPanel selectedUtterance={selectedUtterance} />
        </div>
      </section>

      <footer className="mono rounded-2xl border border-[color:rgba(21,26,23,0.08)] px-3 py-2 text-[11px] text-[color:var(--text-secondary)]">
        {t("runtimeHint")}
      </footer>
    </main>
  );
}
