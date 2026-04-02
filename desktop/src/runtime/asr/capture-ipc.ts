export const CAPTURE_PCM_CHANNEL = "asr:capture-pcm-frame";

export type CapturePcmFramePayload = {
  segmentId: string;
  samples: Float32Array;
  sampleRate: number;
  isFinal: boolean;
};

export function parseCapturePcmFramePayload(value: unknown): CapturePcmFramePayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<CapturePcmFramePayload>;
  if (
    typeof candidate.segmentId !== "string" ||
    typeof candidate.sampleRate !== "number" ||
    !Number.isFinite(candidate.sampleRate) ||
    typeof candidate.isFinal !== "boolean"
  ) {
    return null;
  }

  if (!(candidate.samples instanceof Float32Array)) {
    return null;
  }

  return {
    segmentId: candidate.segmentId,
    samples: candidate.samples,
    sampleRate: candidate.sampleRate,
    isFinal: candidate.isFinal
  };
}
