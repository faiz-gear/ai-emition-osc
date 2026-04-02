import { createAudioWorkletBridge } from "./audio-worklet-bridge";
import { requestCaptureStream } from "./request-capture-stream";

type CaptureBridge = {
  sendPcmFrame(frame: {
    segmentId: string;
    samples: Float32Array;
    sampleRate: number;
    isFinal: boolean;
  }): void;
};

type CaptureWindowGlobals = Window & {
  captureBridge?: CaptureBridge;
};

const SEGMENT_DURATION_SECONDS = 2;

async function bootCaptureRenderer(): Promise<void> {
  const captureBridge = resolveCaptureBridge();
  const stream = await requestCaptureStream();

  const audioContext = new AudioContext({ sampleRate: 16_000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(2048, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  const bridge = createAudioWorkletBridge({ captureBridge });
  let activeSegmentId = createSegmentId();
  let segmentSampleCount = 0;
  const maxSegmentSamples = Math.floor(audioContext.sampleRate * SEGMENT_DURATION_SECONDS);

  processor.onaudioprocess = (event) => {
    const chunk = Float32Array.from(event.inputBuffer.getChannelData(0));
    if (chunk.length === 0) {
      return;
    }

    segmentSampleCount += chunk.length;
    const shouldCloseSegment = segmentSampleCount >= maxSegmentSamples;

    bridge.forward({
      segmentId: activeSegmentId,
      samples: chunk,
      sampleRate: audioContext.sampleRate,
      isFinal: shouldCloseSegment
    });

    if (shouldCloseSegment) {
      activeSegmentId = createSegmentId();
      segmentSampleCount = 0;
    }
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);
}

function resolveCaptureBridge(): CaptureBridge {
  const candidate = (window as CaptureWindowGlobals).captureBridge;
  if (!candidate?.sendPcmFrame) {
    throw new Error("Capture bridge is unavailable: preload captureBridge was not injected");
  }
  return candidate;
}

function createSegmentId(): string {
  return `segment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

void bootCaptureRenderer();
