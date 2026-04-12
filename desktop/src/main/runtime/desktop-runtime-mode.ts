export type DesktopRuntimeMode = "desktop" | "in-memory";

export const DESKTOP_RUNTIME_MODE_ENV = "AI_EMOTION_DESKTOP_RUNTIME_MODE";

export function resolveDesktopRuntimeMode(
  env: NodeJS.ProcessEnv = process.env
): DesktopRuntimeMode {
  const configured = env[DESKTOP_RUNTIME_MODE_ENV]?.trim().toLowerCase();
  if (configured === "desktop" || configured === "in-memory") {
    return configured;
  }

  if (env.NODE_ENV === "test") {
    return "in-memory";
  }

  return "desktop";
}
