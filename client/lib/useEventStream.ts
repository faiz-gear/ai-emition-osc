"use client";

import { useEffect, useRef, useState } from "react";
import type { EventEnvelope } from "./types";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export function useEventStream(
  wsUrl: string,
  onEvent: (event: EventEnvelope) => void
) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  useEffect(() => {
    let ws: WebSocket | null = null;
    let isDisposed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;

    const scheduleReconnect = () => {
      reconnectAttempt += 1;
      const delayMs = Math.min(5000, 500 * reconnectAttempt);
      reconnectTimer = window.setTimeout(() => {
        connect();
      }, delayMs);
    };

    const connect = () => {
      setConnectionState("connecting");
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttempt = 0;
        setConnectionState("connected");
      };

      ws.onmessage = (message) => {
        try {
          const parsed = JSON.parse(String(message.data)) as EventEnvelope;
          onEventRef.current(parsed);
        } catch {
          // ignore malformed message
        }
      };

      ws.onclose = () => {
        setConnectionState("disconnected");
        if (!isDisposed) scheduleReconnect();
      };

      ws.onerror = () => {
        // let onclose handle reconnect
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [wsUrl]);

  return { connectionState };
}

