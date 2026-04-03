import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DashboardI18nProvider, LOCALE_STORAGE_KEY } from "@/lib/i18n";

import { AppShell } from "../AppShell";

function renderWithProvider(activeTab: "console" | "settings") {
  return render(
    <DashboardI18nProvider>
      <AppShell activeTab={activeTab}>
        <div>content</div>
      </AppShell>
    </DashboardI18nProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders console and settings nav links and marks the active tab", () => {
    renderWithProvider("console");

    const consoleLink = screen.getByRole("link", { name: "Console" });
    const settingsLink = screen.getByRole("link", { name: "Settings" });

    expect(consoleLink).toHaveAttribute("href", "/");
    expect(settingsLink).toHaveAttribute("href", "/settings");
    expect(consoleLink).toHaveAttribute("aria-current", "page");
    expect(settingsLink).not.toHaveAttribute("aria-current");
  });

  it("localizes labels from i18n", async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "zh");
    renderWithProvider("settings");

    const consoleLink = await screen.findByRole("link", { name: "控制台" });
    const settingsLink = await screen.findByRole("link", { name: "设置" });

    expect(consoleLink).toHaveAttribute("href", "/");
    expect(settingsLink).toHaveAttribute("href", "/settings");
    expect(settingsLink).toHaveAttribute("aria-current", "page");
  });
});
