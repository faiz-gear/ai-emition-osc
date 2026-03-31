import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardI18nProvider } from "@/lib/i18n";

import { SettingsLanguageSection } from "../SettingsLanguageSection";

describe("SettingsLanguageSection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders both locale options and dispatches locale changes", () => {
    const onChangeLocale = vi.fn();

    render(
      <DashboardI18nProvider>
        <SettingsLanguageSection locale="en" onChangeLocale={onChangeLocale} />
      </DashboardI18nProvider>,
    );

    const english = screen.getByRole("button", { name: "EN" });
    const chinese = screen.getByRole("button", { name: "中文" });

    expect(english).toHaveAttribute("aria-pressed", "true");
    expect(chinese).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(chinese);
    expect(onChangeLocale).toHaveBeenCalledWith("zh");
  });
});
