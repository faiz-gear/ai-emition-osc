import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveTranscriptStage } from "../LiveTranscriptStage";

describe("LiveTranscriptStage", () => {
  it("applies shimmer only when processing", () => {
    const { rerender } = render(
      <LiveTranscriptStage text="processing" isProcessing freshness="LIVE" />,
    );

    expect(screen.getByTestId("live-transcript-text")).toHaveClass(
      "transcript-shimmer",
    );

    rerender(
      <LiveTranscriptStage text="processing" isProcessing={false} freshness="LIVE" />,
    );

    expect(screen.getByTestId("live-transcript-text")).not.toHaveClass(
      "transcript-shimmer",
    );
  });
});
