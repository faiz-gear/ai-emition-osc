import React from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardI18nProvider } from "@/lib/i18n";
import type { RuntimeEvent, RuntimeSnapshot } from "@/lib/types";
import { LiveTranscriptStage } from "../LiveTranscriptStage";

const runtimeState = vi.hoisted(() => ({
  subscriber: null as ((event: RuntimeEvent) => void) | null,
}));

const baseSnapshot: RuntimeSnapshot = {
  status: { listening: false },
  metrics: {
    uptime_seconds: 0,
    ws_clients: 0,
    utterances_total: 0,
    emotion_total: 0,
    errors_total: 0,
  },
  utterances: [],
};

const mockDesktopClient = vi.hoisted(() => ({
  startListening: vi.fn(async () => undefined),
  stopListening: vi.fn(async () => undefined),
  getSnapshot: vi.fn(async () => structuredClone(baseSnapshot)),
  subscribe: vi.fn((subscriber: (event: RuntimeEvent) => void) => {
    runtimeState.subscriber = subscriber;
    return () => {
      runtimeState.subscriber = null;
    };
  }),
  getAsrSettings: vi.fn(async () => ({
    catalog: [],
    installedModels: [],
    recognitionStrategy: { mode: "auto" as const },
  })),
}));

vi.mock("@/lib/desktop/desktop-client", () => ({
  getDesktopClient: () => mockDesktopClient,
}));

vi.mock("@/components/dashboard/EmotionDetailPanel", () => ({
  EmotionDetailPanel: () => <div data-testid="emotion-detail-panel" />,
}));

async function emitRuntimeEvent(event: RuntimeEvent) {
  await act(async () => {
    runtimeState.subscriber?.(event);
  });
}

describe("LiveTranscriptStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeState.subscriber = null;
    mockDesktopClient.getSnapshot.mockResolvedValue(structuredClone(baseSnapshot));

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it("applies shimmer only when processing", () => {
    const { rerender } = render(
      <LiveTranscriptStage text="processing" isProcessing freshness="LIVE" />,
    );

    expect(screen.getByTestId("live-transcript-text")).toHaveClass(
      "transcript-shimmer",
    );

    rerender(
      <LiveTranscriptStage text="processing" isProcessing={false} freshness="LIVE" />,
    );

    expect(screen.getByTestId("live-transcript-text")).not.toHaveClass(
      "transcript-shimmer",
    );
  });

  it("shows waiting copy before the first finalized transcript arrives", () => {
    render(
      <LiveTranscriptStage
        text=""
        isProcessing={false}
        freshness="STALE"
        lastUpdatedAt={null}
      />,
    );

    expect(screen.getByTestId("live-transcript-text")).toHaveTextContent(
      "(Waiting for speech...)",
    );
    expect(
      screen.getByText(
        "Start listening to populate the transcript stream with live speech segments.",
      ),
    ).toBeInTheDocument();
  });

  it("ignores desktop partial-only events while final events drive the dashboard", async () => {
    const { default: DashboardPage } = await import("@/app/page");

    render(
      <DashboardI18nProvider>
        <DashboardPage />
      </DashboardI18nProvider>,
    );

    await waitFor(() => expect(mockDesktopClient.getSnapshot).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockDesktopClient.subscribe).toHaveBeenCalledTimes(1));

    expect(screen.getByText("Stopped")).toBeInTheDocument();

    await emitRuntimeEvent({
      type: "session:status",
      payload: { listening: true },
    });

    expect(await screen.findByText("Listening")).toBeInTheDocument();

    await emitRuntimeEvent({
      type: "runtime:error",
      payload: { message: "Mic pipeline crashed" },
    });

    expect(await screen.findByText("Mic pipeline crashed")).toBeInTheDocument();

    await emitRuntimeEvent({
      type: "runtime:utterance",
      payload: {
        id: "utt-1",
        started_at: "2026-04-01T10:00:00.000Z",
        ended_at: null,
        partial_text: "desktop partial transcript",
        final_text: null,
        emotion_status: "queued",
      },
    });

    expect(screen.queryByText("desktop partial transcript")).not.toBeInTheDocument();

    await emitRuntimeEvent({
      type: "runtime:utterance",
      payload: {
        id: "utt-1",
        started_at: "2026-04-01T10:00:00.000Z",
        ended_at: "2026-04-01T10:00:02.000Z",
        partial_text: "desktop partial transcript",
        final_text: "desktop final transcript",
        emotion_status: "queued",
      },
    });

    expect(screen.getByTestId("live-transcript-text")).toHaveTextContent(
      "desktop final transcript",
    );
    expect(
      within(screen.getByRole("button", { name: /utterance utt-1/i })).getByText(
        "desktop final transcript",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("desktop partial transcript")).not.toBeInTheDocument();
  });
});
