import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardI18nProvider } from "@/lib/i18n";

const mockLoadRuntimeConfig = vi.hoisted(() => vi.fn());
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
  downloadAsrModel: vi.fn(async () => undefined),
  activateAsrModel: vi.fn(async () => undefined),
  deleteAsrModel: vi.fn(async () => undefined),
  updateRecognitionStrategy: vi.fn(async () => ({ mode: "auto" as const })),
  listProviders: vi.fn(async () => ({ providers: [] })),
  createProvider: vi.fn(async () => undefined),
  updateProvider: vi.fn(async () => undefined),
  deleteProvider: vi.fn(async () => undefined),
  testProvider: vi.fn(async () => ({ ok: true, latency_ms: 12 })),
  activateProvider: vi.fn(async () => undefined),
}));

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...actual,
    loadRuntimeConfig: mockLoadRuntimeConfig,
  };
});

vi.mock("@/lib/desktop/desktop-client", () => ({
  getDesktopClient: () => mockDesktopClient,
}));

async function renderSettingsPage() {
  const { SettingsPage } = await import("../SettingsPage");
  return render(
    <DashboardI18nProvider>
      <SettingsPage />
    </DashboardI18nProvider>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockLoadRuntimeConfig.mockReset();
    mockDesktopClient.startListening.mockClear();
    mockDesktopClient.stopListening.mockClear();
    mockDesktopClient.getSnapshot.mockClear();
    mockDesktopClient.subscribe.mockClear();
    mockDesktopClient.getAsrSettings.mockClear();
    mockDesktopClient.downloadAsrModel.mockClear();
    mockDesktopClient.activateAsrModel.mockClear();
    mockDesktopClient.deleteAsrModel.mockClear();
    mockDesktopClient.updateRecognitionStrategy.mockClear();
    mockDesktopClient.listProviders.mockClear();
  });

  it("does not load runtime endpoint config", async () => {
    await renderSettingsPage();
    await waitFor(() => expect(mockDesktopClient.getSnapshot).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockDesktopClient.getAsrSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockDesktopClient.listProviders).toHaveBeenCalledTimes(1));

    expect(mockLoadRuntimeConfig).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("API Base URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("WebSocket URL")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset to Default" })).not.toBeInTheDocument();
  });

  it("shows desktop-backed provider management and asr settings", async () => {
    await renderSettingsPage();

    await waitFor(() => expect(mockDesktopClient.getSnapshot).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockDesktopClient.getAsrSettings).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockDesktopClient.listProviders).toHaveBeenCalledTimes(1));

    expect(screen.getByTestId("provider-section")).toBeInTheDocument();
    expect(screen.getByText("ASR Models")).toBeInTheDocument();
    expect(screen.getByText("Recognition Strategy")).toBeInTheDocument();
  });
});
