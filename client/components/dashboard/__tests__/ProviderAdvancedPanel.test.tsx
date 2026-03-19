import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { PROVIDER_PANEL_STORAGE_KEY } from "@/lib/dashboard/types";

import { ProviderAdvancedPanel } from "../ProviderAdvancedPanel";

describe("ProviderAdvancedPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults collapsed and persists open state", () => {
    render(
      <ProviderAdvancedPanel>
        <div>Provider content</div>
      </ProviderAdvancedPanel>,
    );

    const toggle = screen.getByRole("button", { name: /advanced/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Provider content")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByText("Provider content")).toBeInTheDocument();
    expect(localStorage.getItem(PROVIDER_PANEL_STORAGE_KEY)).toBe("true");
  });
});
