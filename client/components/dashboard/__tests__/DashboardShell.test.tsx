import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardShell } from "../DashboardShell";

describe("DashboardShell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders all required dashboard regions", () => {
    render(
      <DashboardShell
        connectionState="connected"
        listening={false}
        isStarting={false}
        isStopping={false}
        errorMessage={null}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onDismissError={vi.fn()}
        isMobile={false}
        liveText="hello"
        isProcessing={false}
        freshness="LIVE"
        lastUpdatedAt={Date.now()}
        metrics={null}
        utterances={[]}
        selectedId={null}
        followLatest
        onSelectUtterance={vi.fn()}
        onToggleFollow={vi.fn()}
        selectedUtterance={null}
      />,
    );

    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
    expect(screen.getByText(/live transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/realtime ops/i)).toBeInTheDocument();
    expect(screen.getByText(/utterance stream/i)).toBeInTheDocument();
    expect(screen.getAllByText(/emotion detail/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/api:\s*https?:\/\//i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ws:\s*wss?:\/\//i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "EN" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "中文" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /advanced/i })).not.toBeInTheDocument();
  });
});
