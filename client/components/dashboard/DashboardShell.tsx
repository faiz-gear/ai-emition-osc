import React from "react";

import { ControlRail } from "@/components/dashboard/ControlRail";
import { EmotionDetailPanel } from "@/components/dashboard/EmotionDetailPanel";
import { LiveTranscriptStage } from "@/components/dashboard/LiveTranscriptStage";
import { ProviderAdvancedPanel } from "@/components/dashboard/ProviderAdvancedPanel";
import { RealtimeOpsStack } from "@/components/dashboard/RealtimeOpsStack";
import { UtteranceStreamPanel } from "@/components/dashboard/UtteranceStreamPanel";
import type { Freshness } from "@/lib/dashboard/types";
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
  apiBase: string;
  activeProviderId: string | null;
  wsUrl: string;
  providerPanelContent?: React.ReactNode;
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
  apiBase,
  activeProviderId,
  wsUrl,
  providerPanelContent,
}: DashboardShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col gap-[var(--space-3)] px-[var(--space-2)] py-[var(--space-3)] md:px-[var(--space-4)] md:py-[var(--space-4)]">
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

      <div className="grid gap-[var(--space-3)] xl:grid-cols-[minmax(0,1fr)_320px]">
        <LiveTranscriptStage
          text={liveText}
          isProcessing={isProcessing}
          freshness={freshness}
          lastUpdatedAt={lastUpdatedAt}
        />
        <RealtimeOpsStack metrics={metrics} />
      </div>

      <div className="grid gap-[var(--space-3)] xl:grid-cols-2">
        <UtteranceStreamPanel
          utterances={utterances}
          selectedId={selectedId}
          followLatest={followLatest}
          onSelect={onSelectUtterance}
          onToggleFollow={onToggleFollow}
        />
        <EmotionDetailPanel selectedUtterance={selectedUtterance} />
      </div>

      <ProviderAdvancedPanel apiBase={apiBase} activeProviderId={activeProviderId}>
        {providerPanelContent}
      </ProviderAdvancedPanel>

      <footer className="mono px-1 text-[11px] text-[color:var(--text-secondary)]">
        API: {apiBase} | WS: {wsUrl}
      </footer>
    </main>
  );
}
