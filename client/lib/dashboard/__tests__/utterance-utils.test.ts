import { describe, expect, it } from "vitest";

import {
  normalizeAndSortUtterances,
  pickSelectedUtteranceId,
  upsertUtterance,
} from "../utterance-utils";

describe("utterance-utils", () => {
  it("sorts by started_at desc with ended_at/id tiebreakers", () => {
    const sorted = normalizeAndSortUtterances([
      {
        id: "a",
        started_at: "2026-03-19T10:00:00Z",
        emotion_status: "queued",
      },
      {
        id: "b",
        started_at: "2026-03-19T10:00:00Z",
        ended_at: "2026-03-19T10:00:01Z",
        emotion_status: "queued",
      },
    ]);

    expect(sorted[0].id).toBe("b");
  });

  it("sorts invalid timestamps last", () => {
    const sorted = normalizeAndSortUtterances([
      { id: "z", started_at: "INVALID_DATE", emotion_status: "queued" },
      {
        id: "a",
        started_at: "2026-03-19T10:00:00Z",
        emotion_status: "queued",
      },
    ]);

    expect(sorted.at(-1)?.id).toBe("z");
  });

  it("uses id descending as final tiebreak", () => {
    const sorted = normalizeAndSortUtterances([
      {
        id: "a",
        started_at: "2026-03-19T10:00:00Z",
        ended_at: "2026-03-19T10:00:00Z",
        emotion_status: "queued",
      },
      {
        id: "b",
        started_at: "2026-03-19T10:00:00Z",
        ended_at: "2026-03-19T10:00:00Z",
        emotion_status: "queued",
      },
    ]);

    expect(sorted[0].id).toBe("b");
  });

  it("supports upsert update by id", () => {
    const next = upsertUtterance(
      [
        {
          id: "u-1",
          started_at: "2026-03-19T10:00:00Z",
          emotion_status: "queued",
        },
      ],
      { id: "u-1", emotion_status: "done" },
    );

    expect(next[0].emotion_status).toBe("done");
  });

  it("falls back to latest when followLatest is true", () => {
    const nextId = pickSelectedUtteranceId({
      previousSelectedId: "u-1",
      followLatest: true,
      utteranceIds: ["u-2", "u-3"],
    });

    expect(nextId).toBe("u-2");
  });

  it("drops to null when selected item disappears and followLatest is false", () => {
    const nextId = pickSelectedUtteranceId({
      previousSelectedId: "u-1",
      followLatest: false,
      utteranceIds: ["u-2", "u-3"],
    });

    expect(nextId).toBeNull();
  });
});
