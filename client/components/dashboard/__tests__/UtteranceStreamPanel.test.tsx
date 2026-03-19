import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UtteranceStreamPanel } from "../UtteranceStreamPanel";

const fixtures = [
  {
    id: "u-1",
    started_at: "2026-03-19T10:00:00Z",
    emotion_status: "done",
    final_text: "short text",
  },
  {
    id: "u-2",
    started_at: "2026-03-19T10:00:01Z",
    emotion_status: "processing",
    final_text:
      "This is a very long utterance text that should overflow and allow expand collapse behavior when the row is selected by the user.",
  },
] as const;

describe("UtteranceStreamPanel", () => {
  it("calls onToggleFollow(false) when user manually selects another utterance", async () => {
    const onToggleFollow = vi.fn();
    const onSelect = vi.fn();

    render(
      <UtteranceStreamPanel
        followLatest
        selectedId="u-1"
        utterances={fixtures.map((item) => ({ ...item }))}
        onToggleFollow={onToggleFollow}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /utterance u-2/i }));

    expect(onToggleFollow).toHaveBeenCalledWith(false);
    expect(onSelect).toHaveBeenCalledWith("u-2");
  });

  it("supports expand and collapse for long transcript rows", () => {
    render(
      <UtteranceStreamPanel
        followLatest={false}
        selectedId="u-2"
        utterances={fixtures.map((item) => ({ ...item }))}
        onToggleFollow={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /expand u-2/i }));
    expect(screen.getByRole("button", { name: /collapse u-2/i })).toBeInTheDocument();
  });
});
