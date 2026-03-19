import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardShell } from "../DashboardShell";

describe("DashboardShell", () => {
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
        apiBase="http://localhost:8000"
        activeProviderId={null}
        wsUrl="ws://localhost:8000/ws/events"
        providerPanelContent={<div>Provider content</div>}
      />,
    );

    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
    expect(screen.getByText(/live transcript/i)).toBeInTheDocument();
    expect(screen.getByText(/realtime ops/i)).toBeInTheDocument();
    expect(screen.getByText(/utterance stream/i)).toBeInTheDocument();
    expect(screen.getAllByText(/emotion detail/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /advanced/i })).toBeInTheDocument();
    expect(screen.queryByText(/provider content/i)).not.toBeInTheDocument();
  });
});
