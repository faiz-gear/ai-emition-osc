import type { Utterance } from "@/lib/types";

type PickSelectedInput = {
  previousSelectedId: string | null;
  followLatest: boolean;
  utteranceIds: string[];
};

function parseTimestamp(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function compareTimestampDesc(a?: string | null, b?: string | null): number {
  const aValue = parseTimestamp(a);
  const bValue = parseTimestamp(b);

  if (aValue === null && bValue === null) {
    return 0;
  }

  if (aValue === null) {
    return 1;
  }

  if (bValue === null) {
    return -1;
  }

  return bValue - aValue;
}

function compareUtteranceDesc(a: Utterance, b: Utterance): number {
  const startedCompare = compareTimestampDesc(a.started_at, b.started_at);
  if (startedCompare !== 0) {
    return startedCompare;
  }

  const endedCompare = compareTimestampDesc(a.ended_at ?? null, b.ended_at ?? null);
  if (endedCompare !== 0) {
    return endedCompare;
  }

  return b.id.localeCompare(a.id);
}

export function upsertUtterance(
  list: Utterance[],
  patch: Partial<Utterance> & { id: string },
): Utterance[] {
  const index = list.findIndex((utterance) => utterance.id === patch.id);
  if (index === -1) {
    return [
      {
        id: patch.id,
        started_at: patch.started_at ?? "1970-01-01T00:00:00.000Z",
        emotion_status: patch.emotion_status ?? "queued",
        ...patch,
      },
      ...list,
    ];
  }

  const next = [...list];
  next[index] = { ...next[index], ...patch };
  return next;
}

export function normalizeAndSortUtterances(items: Utterance[]): Utterance[] {
  return [...items].sort(compareUtteranceDesc);
}

export function pickSelectedUtteranceId(input: PickSelectedInput): string | null {
  if (
    input.previousSelectedId &&
    input.utteranceIds.includes(input.previousSelectedId)
  ) {
    return input.previousSelectedId;
  }

  if (!input.followLatest) {
    return null;
  }

  return input.utteranceIds[0] ?? null;
}
