import { describe, expect, it } from "vitest";

import { FRESHNESS_THRESHOLDS_MS, PROVIDER_PANEL_STORAGE_KEY } from "../types";

describe("dashboard type contracts", () => {
  it("exports freshness thresholds and storage key constants", () => {
    expect(FRESHNESS_THRESHOLDS_MS.live).toBe(2000);
    expect(PROVIDER_PANEL_STORAGE_KEY).toBe(
      "ai-emotion::dashboard::provider-panel-open::v1",
    );
  });
});
