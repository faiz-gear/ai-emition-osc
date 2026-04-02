import { createAudioWorkletBridge } from "./audio-worklet-bridge";

type IpcRendererLike = {
  postMessage(channel: string, message: unknown, transfer?: readonly ArrayBuffer[]): void;
};

type CaptureWindowGlobals = Window & {
  __captureIpcRenderer__?: IpcRendererLike;
};

const SEGMENT_DURATION_SECONDS = 2;

async function bootCaptureRenderer(): Promise<void> {
  const ipcRenderer = resolveIpcRenderer();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    },
    video: false
  });

  const audioContext = new AudioContext({ sampleRate: 16_000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(2048, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  const bridge = createAudioWorkletBridge({ ipcRenderer });
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

function resolveIpcRenderer(): IpcRendererLike {
  const candidate = (window as CaptureWindowGlobals).__captureIpcRenderer__;
  if (!candidate?.postMessage) {
    throw new Error("Capture bridge is unavailable: __captureIpcRenderer__ was not injected");
  }
  return candidate;
}

function createSegmentId(): string {
  return `segment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

void bootCaptureRenderer();
