import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeConfig } from "@/lib/config";
import {
  DashboardI18nProvider,
  LOCALE_STORAGE_KEY,
} from "@/lib/i18n";

const mockLoadRuntimeConfig = vi.hoisted(() => vi.fn());
const mockSaveRuntimeConfig = vi.hoisted(() => vi.fn());
const mockResetRuntimeConfigToDefault = vi.hoisted(() => vi.fn());

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...actual,
    loadRuntimeConfig: mockLoadRuntimeConfig,
    saveRuntimeConfig: mockSaveRuntimeConfig,
    resetRuntimeConfigToDefault: mockResetRuntimeConfigToDefault,
  };
});

vi.mock("@/components/settings/SettingsProviderSection", () => ({
  SettingsProviderSection: ({
    apiBase,
    apiBaseRevision,
    isEndpointMutating,
  }: {
    apiBase: string;
    apiBaseRevision: number;
    isEndpointMutating: boolean;
  }) => (
    <div
      data-testid="provider-section"
      data-api-base={apiBase}
      data-api-base-revision={String(apiBaseRevision)}
      data-disabled={isEndpointMutating ? "true" : "false"}
    />
  ),
}));

const BASE_CONFIG: RuntimeConfig = {
  apiBase: "http://127.0.0.1:8000",
  wsUrl: "ws://127.0.0.1:8000/ws/events",
};

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
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");

    mockLoadRuntimeConfig.mockReset();
    mockSaveRuntimeConfig.mockReset();
    mockResetRuntimeConfigToDefault.mockReset();

    mockLoadRuntimeConfig.mockReturnValue({
      config: BASE_CONFIG,
      source: "env_default",
      warningCode: null,
    });

    mockSaveRuntimeConfig.mockImplementation((next: RuntimeConfig) => ({
      ok: true,
      config: next,
      warningCode: null,
      validationErrors: [],
      persisted: true,
      errorMessage: null,
    }));

    mockResetRuntimeConfigToDefault.mockReturnValue({
      ok: true,
      config: BASE_CONFIG,
      warningCode: null,
      validationErrors: [],
      persisted: true,
      errorMessage: null,
    });
  });

  it("loads runtime config on mount", async () => {
    await renderSettingsPage();
    expect(mockLoadRuntimeConfig).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("API Base URL")).toHaveValue(BASE_CONFIG.apiBase);
    expect(screen.getByLabelText("WebSocket URL")).toHaveValue(BASE_CONFIG.wsUrl);
  });

  it("increments apiBaseRevision when save changes apiBase", async () => {
    await renderSettingsPage();
    expect(screen.getByTestId("provider-section")).toHaveAttribute(
      "data-api-base-revision",
      "0",
    );

    fireEvent.change(screen.getByLabelText("API Base URL"), {
      target: { value: "https://changed.example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByTestId("provider-section")).toHaveAttribute(
        "data-api-base-revision",
        "1",
      ),
    );
  });

  it("does not increment apiBaseRevision when save only changes wsUrl", async () => {
    await renderSettingsPage();

    fireEvent.change(screen.getByLabelText("WebSocket URL"), {
      target: { value: "wss://changed.example.test/ws/events" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByTestId("provider-section")).toHaveAttribute(
        "data-api-base-revision",
        "0",
      ),
    );
  });

  it("keeps previous effective config and revision when save fails", async () => {
    mockSaveRuntimeConfig.mockReturnValueOnce({
      ok: false,
      config: {
        apiBase: "https://rejected.example.test",
        wsUrl: "wss://rejected.example.test/ws/events",
      },
      warningCode: null,
      validationErrors: [
        {
          field: "apiBase",
          code: "invalid_api_base",
          message: "API base URL must use http:// or https://",
        },
      ],
      persisted: false,
      errorMessage: "Validation failed",
    });

    await renderSettingsPage();
    fireEvent.change(screen.getByLabelText("API Base URL"), {
      target: { value: "https://rejected.example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByTestId("provider-section")).toHaveAttribute(
        "data-api-base",
        BASE_CONFIG.apiBase,
      ),
    );
    expect(screen.getByTestId("provider-section")).toHaveAttribute(
      "data-api-base-revision",
      "0",
    );
  });

  it("prevents overlapping save/reset and disables provider section while mutating", async () => {
    await renderSettingsPage();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset to Default" }));

    expect(screen.getByTestId("provider-section")).toHaveAttribute(
      "data-disabled",
      "true",
    );
    expect(mockResetRuntimeConfigToDefault).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId("provider-section")).toHaveAttribute(
        "data-disabled",
        "false",
      ),
    );
  });

  it("rehydrates persisted endpoint values on remount", async () => {
    let persisted = { ...BASE_CONFIG };
    mockLoadRuntimeConfig.mockImplementation(() => ({
      config: persisted,
      source: "env_default",
      warningCode: null,
    }));
    mockSaveRuntimeConfig.mockImplementation((next: RuntimeConfig) => {
      persisted = next;
      return {
        ok: true,
        config: next,
        warningCode: null,
        validationErrors: [],
        persisted: true,
        errorMessage: null,
      };
    });

    const firstRender = await renderSettingsPage();
    fireEvent.change(screen.getByLabelText("API Base URL"), {
      target: { value: "https://persisted.example.test" },
    });
    fireEvent.change(screen.getByLabelText("WebSocket URL"), {
      target: { value: "wss://persisted.example.test/ws/events" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByTestId("provider-section")).toHaveAttribute(
        "data-api-base",
        "https://persisted.example.test",
      ),
    );

    firstRender.unmount();
    await renderSettingsPage();
    expect(screen.getByLabelText("API Base URL")).toHaveValue(
      "https://persisted.example.test",
    );
    expect(screen.getByLabelText("WebSocket URL")).toHaveValue(
      "wss://persisted.example.test/ws/events",
    );
  });

  it("hydrates dismissed warnings from sessionStorage and writes back on dismiss", async () => {
    sessionStorage.setItem(
      "ai-emotion::runtime-warning-dismissed::v1",
      JSON.stringify(["invalid_json"]),
    );
    mockLoadRuntimeConfig.mockReturnValue({
      config: BASE_CONFIG,
      source: "env_default",
      warningCode: "invalid_json",
    });

    await renderSettingsPage();
    expect(
      screen.queryByText("Stored runtime config is invalid JSON. Defaults were applied."),
    ).not.toBeInTheDocument();

    mockLoadRuntimeConfig.mockReturnValue({
      config: BASE_CONFIG,
      source: "env_default",
      warningCode: "invalid_shape",
    });
    const rerender = await renderSettingsPage();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss warning" }));

    const persistedWarnings = JSON.parse(
      sessionStorage.getItem("ai-emotion::runtime-warning-dismissed::v1") ?? "[]",
    ) as string[];
    expect(persistedWarnings).toContain("invalid_shape");
    rerender.unmount();
  });

  it("falls back to in-memory warning dedupe when sessionStorage is unavailable", async () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("session blocked");
    });

    mockLoadRuntimeConfig.mockReturnValue({
      config: BASE_CONFIG,
      source: "env_default",
      warningCode: "invalid_json",
    });

    await renderSettingsPage();
    expect(
      screen.getByText("Stored runtime config is invalid JSON. Defaults were applied."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss warning" }));
    expect(
      screen.queryByText("Stored runtime config is invalid JSON. Defaults were applied."),
    ).not.toBeInTheDocument();
  });

  it("surfaces non-blocking inline error when storage write fails", async () => {
    mockSaveRuntimeConfig.mockReturnValueOnce({
      ok: true,
      config: {
        apiBase: "https://write-fail.example.test",
        wsUrl: "wss://write-fail.example.test/ws/events",
      },
      warningCode: "storage_unavailable",
      validationErrors: [],
      persisted: false,
      errorMessage: "Unable to persist runtime config",
    });

    await renderSettingsPage();
    fireEvent.change(screen.getByLabelText("API Base URL"), {
      target: { value: "https://write-fail.example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByText("Unable to persist runtime config")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("provider-section")).toHaveAttribute(
      "data-api-base",
      "https://write-fail.example.test",
    );
  });
});
