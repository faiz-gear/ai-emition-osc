import { resolve } from "node:path";

export function resolvePreloadPath(currentDir: string): string {
  return resolve(currentDir, "../preload/index.mjs");
}
