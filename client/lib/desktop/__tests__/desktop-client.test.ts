import type { DesktopApi, RuntimeEvent, RuntimeSnapshot } from "@ai-emotion/contracts";
import { describe, expect, it, vi } from "vitest";

import { createDesktopClient } from "../desktop-client";
import { mapRuntimeEventToEnvelopes, mapRuntimeSnapshot } from "../desktop-events";

function createDesktopApiMock() {
  const subscribe = vi.fn<(listener: (event: RuntimeEvent) => void) => () => void>();

  const desktopApi = {
    session: {
      startListening: vi.fn(async () => undefined),
      stopListening: vi.fn(async () => undefined),
      getSnapshot: vi.fn<() => Promise<RuntimeSnapshot>>(),
      subscribe,
    },
    asr: {
      listCatalog: vi.fn(async () => []),
      listInstalled: vi.fn(async () => []),
      downloadModel: vi.fn(async () => undefined),
      activateModel: vi.fn(async () => undefined),
      deleteModel: vi.fn(async () => undefined),
      getRecognitionStrategy: vi.fn(async () => ({ mode: "auto" as const })),
      updateRecognitionStrategy: vi.fn(async () => ({ mode: "auto" as const })),
    },
    providers: {
      list: vi.fn(async () => ({ providers: [] })),
      create: vi.fn(async () => ({
        id: "provider-1",
        name: "Desktop Provider",
        provider_type: "ollama" as const,
        model: "llama3",
        is_active: false,
        updated_at: "2026-04-01T00:00:00.000Z",
        status: "ok" as const,
      })),
      update: vi.fn(async () => ({
        id: "provider-1",
        name: "Desktop Provider",
        provider_type: "ollama" as const,
        model: "llama3",
        is_active: false,
        updated_at: "2026-04-01T00:00:00.000Z",
        status: "ok" as const,
      })),
      delete: vi.fn(async () => undefined),
      test: vi.fn(async () => ({ ok: true, latency_ms: 42 })),
      activate: vi.fn(async () => undefined),
    },
  } as unknown as DesktopApi;

  return { desktopApi, subscribe };
}

describe("desktop-client", () => {
  it("fetches snapshot through preload-backed desktop api", async () => {
    const snapshot: RuntimeSnapshot = {
      status: { listening: true },
      metrics: {
        uptime_seconds: 10,
        ws_clients: 1,
        utterances_total: 2,
        emotion_total: 1,
        errors_total: 0,
      },
      utterances: [],
    };
    const { desktopApi } = createDesktopApiMock();
    desktopApi.session.getSnapshot = vi.fn(async () => snapshot);

    const client = createDesktopClient(desktopApi);
    await expect(client.getSnapshot()).resolves.toEqual(snapshot);
    expect(desktopApi.session.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it("exposes preload runtime events without remapping", () => {
    const { desktopApi, subscribe } = createDesktopApiMock();
    let runtimeListener: ((event: RuntimeEvent) => void) | null = null;
    const unsubscribe = vi.fn();

    subscribe.mockImplementation((listener) => {
      runtimeListener = listener;
      return unsubscribe;
    });

    const onEvent = vi.fn();
    const client = createDesktopClient(desktopApi);
    const stop = client.subscribe(onEvent);

    runtimeListener?.({
      type: "runtime:metrics",
      payload: {
        uptime_seconds: 1,
        ws_clients: 1,
        utterances_total: 1,
        emotion_total: 0,
        errors_total: 0,
      },
    });
    runtimeListener?.({
      type: "runtime:utterance",
      payload: {
        id: "utt-1",
        started_at: "2026-04-01T00:00:00.000Z",
        partial_text: "hello",
        emotion_status: "queued",
      },
    });
    runtimeListener?.({
      type: "emotion:started",
      payload: { utteranceId: "utt-1" },
    });
    runtimeListener?.({
      type: "runtime:utterance",
      payload: {
        id: "utt-1",
        started_at: "2026-04-01T00:00:00.000Z",
        ended_at: "2026-04-01T00:00:01.000Z",
        final_text: "hello world",
        emotion_status: "done",
        emotion: {
          dominant_emotion: "joy",
          brief_explanation: "positive tone",
          dimensions: {
            joy: 0.8,
            trust: 0.2,
            fear: 0,
            surprise: 0.1,
            sadness: 0,
            disgust: 0,
            anger: 0,
            anticipation: 0.3,
          },
        },
        latency_ms: 42,
      },
    });
    runtimeListener?.({
      type: "runtime:error",
      payload: { code: "RUNTIME_UNAVAILABLE", message: "runtime down" },
    });

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "runtime:metrics" }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "runtime:utterance",
        payload: expect.objectContaining({
          id: "utt-1",
          partial_text: "hello",
        }),
      }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "emotion:started" }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "runtime:utterance",
        payload: expect.objectContaining({
          id: "utt-1",
          final_text: "hello world",
          emotion_status: "done",
          latency_ms: 42,
        }),
      }),
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "runtime:error",
        payload: { code: "RUNTIME_UNAVAILABLE", message: "runtime down" },
      }),
    );

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("maps desktop runtime events into the existing reducer event shape", () => {
    const snapshot = mapRuntimeSnapshot({
      status: { listening: true },
      metrics: {
        uptime_seconds: 10,
        ws_clients: 1,
        utterances_total: 1,
        emotion_total: 0,
        errors_total: 0,
      },
      utterances: [],
    });

    expect(
      mapRuntimeEventToEnvelopes(
        {
          type: "runtime:utterance",
          payload: {
            id: "utt-1",
            started_at: "2026-04-01T00:00:00.000Z",
            ended_at: "2026-04-01T00:00:01.000Z",
            final_text: "hello world",
            emotion_status: "done",
            emotion: {
              dominant_emotion: "joy",
              brief_explanation: "positive tone",
              dimensions: {
                joy: 0.8,
                trust: 0.2,
                fear: 0,
                surprise: 0.1,
                sadness: 0,
                disgust: 0,
                anger: 0,
                anticipation: 0.3,
              },
            },
            latency_ms: 42,
          },
        },
        snapshot.status,
      ),
    ).toEqual([
      expect.objectContaining({
        type: "asr_final",
        data: expect.objectContaining({
          utterance_id: "utt-1",
          final_text: "hello world",
        }),
      }),
      expect.objectContaining({
        type: "emotion_result",
        data: expect.objectContaining({
          utterance_id: "utt-1",
          latency_ms: 42,
          emotion: expect.objectContaining({
            dominant_emotion: "joy",
          }),
        }),
      }),
    ]);
  });

  it("aggregates asr settings through the preload api", async () => {
    const { desktopApi } = createDesktopApiMock();
    desktopApi.asr.listCatalog = vi.fn(async () => [
      {
        modelId: "whisper-base",
        name: "Whisper Base",
        language: "multilingual",
        sizeBytes: 1024,
      },
    ]);
    desktopApi.asr.listInstalled = vi.fn(async () => [
      {
        modelId: "whisper-base",
        installedAt: "2026-04-01T00:00:00.000Z",
        sizeBytes: 1024,
        active: true,
      },
    ]);
    desktopApi.asr.getRecognitionStrategy = vi.fn(async () => ({
      mode: "fixed" as const,
      fixedLanguage: "zh" as const,
    }));

    const client = createDesktopClient(desktopApi);

    await expect(client.getAsrSettings()).resolves.toEqual({
      catalog: [
        {
          modelId: "whisper-base",
          name: "Whisper Base",
          language: "multilingual",
          sizeBytes: 1024,
        },
      ],
      installedModels: [
        {
          modelId: "whisper-base",
          installedAt: "2026-04-01T00:00:00.000Z",
          sizeBytes: 1024,
          active: true,
        },
      ],
      recognitionStrategy: {
        mode: "fixed",
        fixedLanguage: "zh",
      },
    });
  });

  it("forwards asr mutation methods through the preload api", async () => {
    const { desktopApi } = createDesktopApiMock();
    desktopApi.asr.updateRecognitionStrategy = vi.fn(async () => ({
      mode: "fixed" as const,
      fixedLanguage: "en" as const,
    }));

    const client = createDesktopClient(desktopApi);

    await client.downloadAsrModel("whisper-base");
    await client.activateAsrModel("whisper-base");
    await client.deleteAsrModel("whisper-base");
    await expect(
      client.updateRecognitionStrategy({ mode: "fixed", fixedLanguage: "en" }),
    ).resolves.toEqual({
      mode: "fixed",
      fixedLanguage: "en",
    });

    expect(desktopApi.asr.downloadModel).toHaveBeenCalledWith("whisper-base");
    expect(desktopApi.asr.activateModel).toHaveBeenCalledWith("whisper-base");
    expect(desktopApi.asr.deleteModel).toHaveBeenCalledWith("whisper-base");
    expect(desktopApi.asr.updateRecognitionStrategy).toHaveBeenCalledWith({
      mode: "fixed",
      fixedLanguage: "en",
    });
  });

  it("forwards provider management methods through the preload api", async () => {
    const { desktopApi } = createDesktopApiMock();
    desktopApi.providers.list = vi.fn(async () => ({
      providers: [
        {
          id: "provider-1",
          name: "Desktop Provider",
          provider_type: "ollama",
          model: "llama3",
          is_active: true,
          updated_at: "2026-04-01T00:00:00.000Z",
          status: "ok",
        },
      ],
    }));

    const client = createDesktopClient(desktopApi);

    await expect(client.listProviders()).resolves.toEqual({
      providers: [
        expect.objectContaining({
          id: "provider-1",
          is_active: true,
        }),
      ],
    });

    await client.createProvider({
      name: "Desktop Provider",
      provider_type: "ollama",
      model: "llama3",
      api_key: null,
      base_url: null,
      headers: null,
      provider_key: null,
      temperature: null,
    });
    await client.updateProvider("provider-1", { model: "llama3.1" });
    await client.deleteProvider("provider-1");
    await expect(client.testProvider("provider-1")).resolves.toEqual({
      ok: true,
      latency_ms: 42,
    });
    await client.activateProvider("provider-1");

    expect(desktopApi.providers.list).toHaveBeenCalledTimes(1);
    expect(desktopApi.providers.create).toHaveBeenCalledWith({
      name: "Desktop Provider",
      provider_type: "ollama",
      model: "llama3",
      api_key: null,
      base_url: null,
      headers: null,
      provider_key: null,
      temperature: null,
    });
    expect(desktopApi.providers.update).toHaveBeenCalledWith("provider-1", {
      model: "llama3.1",
    });
    expect(desktopApi.providers.delete).toHaveBeenCalledWith("provider-1");
    expect(desktopApi.providers.test).toHaveBeenCalledWith("provider-1");
    expect(desktopApi.providers.activate).toHaveBeenCalledWith("provider-1");
  });
});
