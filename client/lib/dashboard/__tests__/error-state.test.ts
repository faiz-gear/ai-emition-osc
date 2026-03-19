import { expect, it } from "vitest";

import {
  applyErrorEvent,
  applyRefresh,
  deriveErrorVisibility,
  dismissError,
} from "../error-state";

it("treats status_last_error changes as new_error", () => {
  const state = applyErrorEvent({
    current: null,
    source: "status_last_error",
    message: "backend timeout",
  });

  expect(state.errorVersion).toBe(1);
  expect(state.visible).toBe(true);
});

it("re-shows identical message when version increments", () => {
  const first = applyErrorEvent({
    current: null,
    source: "ws_error_event",
    message: "timeout",
  });
  const dismissed = dismissError(first.visibleKey);
  const second = applyErrorEvent({
    current: { ...first, dismissedKey: dismissed },
    source: "ws_error_event",
    message: "timeout",
  });

  expect(second.visible).toBe(true);
});

it("dismiss hides current error until refresh or new version", () => {
  const first = applyErrorEvent({
    current: null,
    source: "control_failure",
    message: "timeout",
  });
  const dismissed = dismissError(first.visibleKey);
  const hidden = deriveErrorVisibility({
    message: "timeout",
    errorVersion: first.errorVersion,
    dismissedKey: dismissed,
  });

  expect(hidden.visible).toBe(false);
});

it("refresh clears dismissal and shows latest status error", () => {
  const refreshed = applyRefresh({ message: "backend timeout" });

  expect(refreshed.visible).toBe(true);
});
