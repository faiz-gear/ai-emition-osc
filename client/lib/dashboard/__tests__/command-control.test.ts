import { expect, it } from "vitest";

import { createCommandTracker, withCommandTimeout } from "../command-control";

it("aborts command after timeout", async () => {
  await expect(
    withCommandTimeout(async (_signal) => new Promise(() => {}), 5),
  ).rejects.toThrow(/aborted|timeout/i);
});

it("ignores stale command response by sequence id", () => {
  const tracker = createCommandTracker();
  const seq1 = tracker.next();
  const seq2 = tracker.next();

  expect(tracker.isLatest(seq1)).toBe(false);
  expect(tracker.isLatest(seq2)).toBe(true);
});
