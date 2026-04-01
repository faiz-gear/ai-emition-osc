import * as electron from "electron";
import { DesktopEventChannel, type RuntimeEvent } from "@ai-emotion/contracts";

export type RuntimeEventBus = {
  publish(event: RuntimeEvent): void;
  subscribe(listener: (event: RuntimeEvent) => void): () => void;
};

export function createRuntimeEventBus(): RuntimeEventBus {
  const listeners = new Set<(event: RuntimeEvent) => void>();

  return {
    publish(event) {
      for (const listener of listeners) {
        listener(event);
      }

      for (const window of electron.BrowserWindow?.getAllWindows?.() ?? []) {
        window.webContents.send(DesktopEventChannel.RuntimeEvent, event);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
