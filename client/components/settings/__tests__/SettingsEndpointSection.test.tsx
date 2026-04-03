import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeConfig } from "@/lib/config";
import { DashboardI18nProvider } from "@/lib/i18n";

import { SettingsEndpointSection } from "../SettingsEndpointSection";

const BASE_CONFIG: RuntimeConfig = {
  apiBase: "http://127.0.0.1:8000",
  wsUrl: "ws://127.0.0.1:8000/ws/events",
};

function renderSection(
  overrides?: Partial<React.ComponentProps<typeof SettingsEndpointSection>>,
) {
  const onSave = vi.fn();
  const onReset = vi.fn();
  const onDismissWarning = vi.fn();

  const props: React.ComponentProps<typeof SettingsEndpointSection> = {
    value: BASE_CONFIG,
    warningCode: null,
    dismissedWarningCodes: [],
    validationErrors: [],
    isSaving: false,
    actionErrorMessage: null,
    onSave,
    onReset,
    onDismissWarning,
    ...overrides,
  };

  const view = render(
    <DashboardI18nProvider>
      <SettingsEndpointSection {...props} />
    </DashboardI18nProvider>,
  );

  return { ...view, props, onSave, onReset, onDismissWarning };
}

describe("SettingsEndpointSection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders endpoint inputs and calls onSave with form values", () => {
    const { onSave } = renderSection();

    fireEvent.change(screen.getByLabelText("API Base URL"), {
      target: { value: "https://example.test" },
    });
    fireEvent.change(screen.getByLabelText("WebSocket URL"), {
      target: { value: "wss://example.test/ws/events" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      apiBase: "https://example.test",
      wsUrl: "wss://example.test/ws/events",
    });
  });

  it("disables save/reset while mutating", () => {
    renderSection({ isSaving: true });

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset to Default" })).toBeDisabled();
  });

  it("hides warning banner when dismissed and dispatches dismissal", () => {
    const { onDismissWarning } = renderSection({
      warningCode: "invalid_json",
      dismissedWarningCodes: [],
    });

    expect(
      screen.getByText("Stored runtime config is invalid JSON. Defaults were applied."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss warning" }));
    expect(onDismissWarning).toHaveBeenCalledWith("invalid_json");
  });

  it("does not render warning banner when warning code is dismissed", () => {
    renderSection({
      warningCode: "invalid_json",
      dismissedWarningCodes: ["invalid_json"],
    });

    expect(
      screen.queryByText("Stored runtime config is invalid JSON. Defaults were applied."),
    ).not.toBeInTheDocument();
  });
});
