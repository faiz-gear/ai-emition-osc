import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardI18nProvider } from "@/lib/i18n";

const mockDesktopClient = vi.hoisted(() => ({
  startListening: vi.fn(async () => undefined),
  stopListening: vi.fn(async () => undefined),
  getSnapshot: vi.fn(async () => ({
    status: { listening: false },
    metrics: {
      uptime_seconds: 0,
      ws_clients: 0,
      utterances_total: 0,
      emotion_total: 0,
      errors_total: 0,
    },
    utterances: [],
  })),
  subscribe: vi.fn(() => vi.fn()),
  getAsrSettings: vi.fn(async () => ({
    catalog: [],
    installedModels: [],
    recognitionStrategy: { mode: "auto" as const },
  })),
}));

vi.mock("@/lib/desktop/desktop-client", () => {
  return {
    getDesktopClient: () => mockDesktopClient,
  };
});

vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({
    onStart,
    onStop,
  }: {
    onStart: () => void;
    onStop: () => void;
  }) => (
    <div data-testid="dashboard-shell">
      <button type="button" onClick={onStart}>
        start
      </button>
      <button type="button" onClick={onStop}>
        stop
      </button>
    </div>
  ),
}));

describe("ConsoleRoute", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockDesktopClient.startListening.mockClear();
    mockDesktopClient.stopListening.mockClear();
    mockDesktopClient.getSnapshot.mockClear();
    mockDesktopClient.subscribe.mockClear();
    mockDesktopClient.getAsrSettings.mockClear();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it("uses desktop client for snapshot and start/stop listening", async () => {
    const { default: ConsoleRoute } = await import("../page");

    render(
      <DashboardI18nProvider>
        <ConsoleRoute />
      </DashboardI18nProvider>,
    );

    await waitFor(() => expect(mockDesktopClient.getSnapshot).toHaveBeenCalled());
    await waitFor(() => expect(mockDesktopClient.subscribe).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockDesktopClient.startListening).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("link", { name: "Console" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );

    fireEvent.click(screen.getByRole("button", { name: "start" }));
    await waitFor(() => expect(mockDesktopClient.startListening).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole("button", { name: "stop" }));
    await waitFor(() => expect(mockDesktopClient.stopListening).toHaveBeenCalledTimes(1));
  });
});
