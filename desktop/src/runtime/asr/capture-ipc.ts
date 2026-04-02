import { isDesktopErrorCode, type DesktopErrorCode } from "@ai-emotion/contracts";

export const CAPTURE_PCM_CHANNEL = "asr:capture-pcm-frame";
export const CAPTURE_STATUS_CHANNEL = "asr:capture-status";

export type CapturePcmFramePayload = {
  segmentId: string;
  samples: Float32Array;
  sampleRate: number;
  isFinal: boolean;
};

export type CaptureStatusPayload =
  | { type: "ready" }
  | { type: "error"; message: string; code?: DesktopErrorCode };

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

export function parseCaptureStatusPayload(value: unknown): CaptureStatusPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<CaptureStatusPayload>;
  if (candidate.type === "ready") {
    return { type: "ready" };
  }

  if (candidate.type !== "error" || typeof candidate.message !== "string") {
    return null;
  }

  if (
    candidate.code !== undefined &&
    (typeof candidate.code !== "string" || !isDesktopErrorCode(candidate.code))
  ) {
    return null;
  }

  return {
    type: "error",
    message: candidate.message,
    code: candidate.code
  };
}
