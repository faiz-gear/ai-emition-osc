import type { CapturePcmFramePayload } from "./capture-ipc";

export type CaptureFrameListener = (
  frame: CapturePcmFramePayload
) => Promise<void> | void;

export type CaptureFrameSource = {
  subscribe(listener: CaptureFrameListener): () => void;
  dispatch(frame: CapturePcmFramePayload): Promise<void>;
  getSubscriberCount(): number;
};

export function createCaptureFrameSource(): CaptureFrameSource {
  const listeners = new Set<CaptureFrameListener>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async dispatch(frame) {
      await Promise.all([...listeners].map((listener) => listener(frame)));
    },
    getSubscriberCount() {
      return listeners.size;
    }
  };
}
