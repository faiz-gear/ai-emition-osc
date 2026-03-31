import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardI18nProvider } from "@/lib/i18n";

const mockLoadRuntimeConfig = vi.hoisted(() => vi.fn());
const mockUseEventStream = vi.hoisted(() => vi.fn());

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...actual,
    loadRuntimeConfig: mockLoadRuntimeConfig,
    DEFAULT_RUNTIME_CONFIG: {
      apiBase: "http://127.0.0.1:8000",
      wsUrl: "ws://127.0.0.1:8000/ws/events",
    },
  };
});

vi.mock("@/lib/useEventStream", () => ({
  useEventStream: mockUseEventStream,
}));

vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: () => <div data-testid="dashboard-shell" />,
}));

describe("ConsoleRoute", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLoadRuntimeConfig.mockReset();
    mockUseEventStream.mockReset();

    mockLoadRuntimeConfig.mockReturnValue({
      config: {
        apiBase: "https://runtime.example.test",
        wsUrl: "wss://runtime.example.test/ws/events",
      },
      source: "local_storage",
      warningCode: null,
    });

    mockUseEventStream.mockReturnValue({ connectionState: "connected" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: { listening: false },
          metrics: {
            uptime_seconds: 0,
            ws_clients: 0,
            utterances_total: 0,
            emotion_total: 0,
            errors_total: 0,
          },
          config: {
            vosk_model_path: "",
            sample_rate: 16000,
            llm_model: "model",
            osc_target: "",
            event_buffer_size: 128,
            active_provider: null,
          },
        }),
        text: async () => "",
      }),
    );

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it("binds runtime api/ws config to fetch and event stream", async () => {
    const { default: ConsoleRoute } = await import("../page");

    render(
      <DashboardI18nProvider>
        <ConsoleRoute />
      </DashboardI18nProvider>,
    );

    await waitFor(() =>
      expect(mockUseEventStream).toHaveBeenCalledWith(
        "wss://runtime.example.test/ws/events",
        expect.any(Function),
      ),
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "https://runtime.example.test/api/listening/start",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    expect(screen.getByRole("link", { name: "Console" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });
});
