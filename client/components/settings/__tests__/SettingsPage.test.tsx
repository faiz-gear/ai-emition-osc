import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardI18nProvider } from "@/lib/i18n";

const mockLoadRuntimeConfig = vi.hoisted(() => vi.fn());

vi.mock("@/lib/config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config")>("@/lib/config");
  return {
    ...actual,
    loadRuntimeConfig: mockLoadRuntimeConfig,
  };
});

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
  });

  it("does not load runtime endpoint config", async () => {
    await renderSettingsPage();

    expect(mockLoadRuntimeConfig).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("API Base URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("WebSocket URL")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset to Default" })).not.toBeInTheDocument();
  });

  it("hides provider management until desktop-backed settings arrive", async () => {
    await renderSettingsPage();

    expect(screen.queryByTestId("provider-section")).not.toBeInTheDocument();
  });
});
