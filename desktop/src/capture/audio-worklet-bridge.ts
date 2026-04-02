export const CAPTURE_PCM_CHANNEL = "asr:capture-pcm-frame";

export type CapturePcmFrame = {
  segmentId: string;
  samples: Float32Array;
  sampleRate: number;
  isFinal: boolean;
};

type IpcRendererLike = {
  postMessage(channel: string, message: unknown, transfer?: readonly MessagePort[] | readonly ArrayBuffer[]): void;
};

export type AudioWorkletBridge = {
  forward(frame: CapturePcmFrame): void;
};

export function createAudioWorkletBridge(options: {
  ipcRenderer: IpcRendererLike;
  channel?: string;
}): AudioWorkletBridge {
  const channel = options.channel ?? CAPTURE_PCM_CHANNEL;

  return {
    forward(frame) {
      const normalized = normalizePcm(frame.samples);
      options.ipcRenderer.postMessage(
        channel,
        {
          segmentId: frame.segmentId,
          sampleRate: frame.sampleRate,
          isFinal: frame.isFinal,
          samples: normalized
        },
        [normalized.buffer]
      );
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
