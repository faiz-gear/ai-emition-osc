import type { CapturePcmFramePayload } from "../runtime/asr/capture-ipc";

export type CapturePcmFrame = {
  segmentId: string;
  samples: Float32Array;
  sampleRate: number;
  isFinal: boolean;
};

type CaptureBridge = {
  sendPcmFrame(frame: CapturePcmFramePayload): void;
};

export type AudioWorkletBridge = {
  forward(frame: CapturePcmFrame): void;
};

export function createAudioWorkletBridge(options: {
  captureBridge: CaptureBridge;
}): AudioWorkletBridge {
  return {
    forward(frame) {
      const normalized = normalizePcm(frame.samples);
      options.captureBridge.sendPcmFrame({
        segmentId: frame.segmentId,
        sampleRate: frame.sampleRate,
        isFinal: frame.isFinal,
        samples: normalized
      });
    }
  };
}

function normalizePcm(input: Float32Array): Float32Array {
  if (input.length === 0) {
    return new Float32Array(0);
  }

  let peak = 0;
  for (const sample of input) {
    const magnitude = Math.abs(sample);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }

  if (peak <= 1) {
    return Float32Array.from(input);
  }

  const gain = 1 / peak;
  const output = new Float32Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    output[index] = input[index] * gain;
  }
  return output;
}
