import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ControlRail } from "../ControlRail";

describe("ControlRail", () => {
  it("shows compact mobile error trigger and opens sheet", async () => {
    render(
      <ControlRail
        isMobile
        connectionState="connected"
        listening={false}
        isStarting={false}
        isStopping={false}
        hasError
        errorMessage="x"
        onStart={vi.fn()}
        onStop={vi.fn()}
        onDismissError={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /show error details/i }),
    );

    expect(screen.getByText("x")).toBeInTheDocument();
  });
});
