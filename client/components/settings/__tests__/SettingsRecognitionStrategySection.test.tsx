import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardI18nProvider } from "@/lib/i18n";

import { SettingsRecognitionStrategySection } from "../SettingsRecognitionStrategySection";

function renderSection({
  strategy = { mode: "auto" as const },
  listening = false,
  onChangeMode = vi.fn(),
  onChangeFixedLanguage = vi.fn(),
}: {
  strategy?: { mode: "auto" } | { mode: "fixed"; fixedLanguage: "zh" | "en" };
  listening?: boolean;
  onChangeMode?: ReturnType<typeof vi.fn>;
  onChangeFixedLanguage?: ReturnType<typeof vi.fn>;
} = {}) {
  const view = render(
    <DashboardI18nProvider>
      <SettingsRecognitionStrategySection
        value={strategy}
        disabled={listening}
        onChangeMode={onChangeMode}
        onChangeFixedLanguage={onChangeFixedLanguage}
      />
    </DashboardI18nProvider>,
  );

  return { ...view, onChangeMode, onChangeFixedLanguage };
}

describe("SettingsRecognitionStrategySection", () => {
  it("toggles between auto detect and fixed language", () => {
    const { onChangeMode, rerender } = renderSection();

    fireEvent.click(screen.getByRole("radio", { name: "Fixed Language" }));

    rerender(
      <DashboardI18nProvider>
        <SettingsRecognitionStrategySection
          value={{ mode: "fixed", fixedLanguage: "en" }}
          onChangeMode={onChangeMode}
          onChangeFixedLanguage={vi.fn()}
        />
      </DashboardI18nProvider>,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Auto Detect" }));

    expect(onChangeMode).toHaveBeenNthCalledWith(1, "fixed");
    expect(onChangeMode).toHaveBeenNthCalledWith(2, "auto");
  });

  it("offers only Chinese and English when fixed language is selected", () => {
    const { onChangeFixedLanguage } = renderSection({
      strategy: { mode: "fixed", fixedLanguage: "en" },
    });

    const select = screen.getByRole("combobox", { name: "Recognition Language" });
    const optionLabels = screen
      .getAllByRole("option")
      .map((option) => option.textContent?.trim());

    expect(optionLabels).toEqual(["English", "Chinese"]);

    fireEvent.change(select, { target: { value: "zh" } });
    expect(onChangeFixedLanguage).toHaveBeenCalledWith("zh");
  });

  it("disables strategy changes while listening", () => {
    const { onChangeMode } = renderSection({ listening: true });

    const autoRadio = screen.getByRole("radio", { name: "Auto Detect" });
    const fixedRadio = screen.getByRole("radio", { name: "Fixed Language" });

    expect(autoRadio).toBeDisabled();
    expect(fixedRadio).toBeDisabled();
    expect(
      screen.getByText("Stop listening to change the recognition strategy."),
    ).toBeInTheDocument();
    expect(onChangeMode).not.toHaveBeenCalled();
  });
});
