"use client";

import type { ConnectionState } from "@/lib/useEventStream";

export function ConnectionBadge({
  connectionState
}: {
  connectionState: ConnectionState;
}) {
  const label =
    connectionState === "connected"
      ? "Connected"
      : connectionState === "connecting"
        ? "Connecting"
        : "Disconnected";

  const color =
    connectionState === "connected"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : connectionState === "connecting"
        ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
        : "bg-rose-500/15 text-rose-300 ring-rose-500/30";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs ring-1 ${color}`}
    >
      {label}
    </span>
  );
}

