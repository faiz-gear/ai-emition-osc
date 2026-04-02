import * as electron from "electron";
import {
  DesktopEventChannel,
  type EmotionResult,
  type RuntimeEvent,
  type RuntimeSnapshot,
  type Utterance
} from "@ai-emotion/contracts";

export type RuntimeEventBus = {
  getSnapshot(): RuntimeSnapshot;
  setSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot;
  publish(event: RuntimeEvent): void;
  subscribe(listener: (event: RuntimeEvent) => void): () => void;
};

export function createRuntimeEventBus(initialSnapshot: RuntimeSnapshot): RuntimeEventBus {
  const listeners = new Set<(event: RuntimeEvent) => void>();
  let snapshot = cloneSnapshot(initialSnapshot);

  function publishEvent(event: RuntimeEvent): void {
    for (const listener of listeners) {
      listener(event);
    }

    for (const window of electron.BrowserWindow?.getAllWindows?.() ?? []) {
      window.webContents.send(DesktopEventChannel.RuntimeEvent, event);
    }
  }

  return {
    getSnapshot() {
      return cloneSnapshot(snapshot);
    },
    setSnapshot(nextSnapshot) {
      snapshot = cloneSnapshot(nextSnapshot);
      publishEvent({
        type: "runtime:snapshot",
        payload: cloneSnapshot(snapshot)
      });
      return cloneSnapshot(snapshot);
    },
    publish(event) {
      publishEvent(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function cloneSnapshot(snapshot: RuntimeSnapshot): RuntimeSnapshot {
  return {
    status: {
      ...snapshot.status
    },
    metrics: {
      ...snapshot.metrics
    },
    utterances: snapshot.utterances.map(cloneUtterance)
  };
}

function cloneUtterance(utterance: Utterance): Utterance {
  return {
    ...utterance,
    emotion: utterance.emotion ? cloneEmotionResult(utterance.emotion) : utterance.emotion ?? null
  };
}

function cloneEmotionResult(result: EmotionResult): EmotionResult {
  return {
    ...result,
    dimensions: {
      ...result.dimensions
    }
  };
}
