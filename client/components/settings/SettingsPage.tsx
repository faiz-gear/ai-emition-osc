"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FixedLanguage, RecognitionStrategy, RuntimeEvent } from "@ai-emotion/contracts";

import type { ProviderManagerTransport } from "@/components/ProviderManager";
import { getDesktopClient, type DesktopRuntimeClient } from "@/lib/desktop/desktop-client";
import { useI18n } from "@/lib/i18n";
import type { AsrSettingsState } from "@/lib/types";

import { SettingsAsrModelSection, type AsrModelDownloadState } from "./SettingsAsrModelSection";
import { SettingsLanguageSection } from "./SettingsLanguageSection";
import { SettingsProviderSection } from "./SettingsProviderSection";
import { SettingsRecognitionStrategySection } from "./SettingsRecognitionStrategySection";

const EMPTY_ASR_SETTINGS: AsrSettingsState = {
  catalog: [],
  installedModels: [],
  recognitionStrategy: { mode: "auto" },
};

function clampProgress(receivedBytes: number, totalBytes: number) {
  if (totalBytes <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((receivedBytes / totalBytes) * 100)));
}

export function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
  const desktopClientRef = useRef<DesktopRuntimeClient | null>(null);
  const [desktopClient, setDesktopClient] = useState<DesktopRuntimeClient | null>(null);
  const [listening, setListening] = useState(false);
  const [asrSettings, setAsrSettings] = useState<AsrSettingsState>(EMPTY_ASR_SETTINGS);
  const [downloadStates, setDownloadStates] = useState<
    Record<string, AsrModelDownloadState | undefined>
  >({});

  const refreshAsrSettings = useCallback(async (client: DesktopRuntimeClient) => {
    const nextSettings = await client.getAsrSettings();
    setAsrSettings(nextSettings);
  }, []);

  const applyRuntimeEvent = useCallback(
    (event: RuntimeEvent) => {
      if (event.type === "runtime:snapshot") {
        setListening(event.payload.status.listening);
        return;
      }

      if (event.type === "session:status") {
        setListening(event.payload.listening);
        return;
      }

      if (event.type === "asr:download-progress") {
        setDownloadStates((current) => ({
          ...current,
          [event.payload.modelId]: {
            status: current[event.payload.modelId]?.status ?? "downloading",
            progressPercent: clampProgress(
              event.payload.receivedBytes,
              event.payload.totalBytes,
            ),
          },
        }));
        return;
      }

      if (event.type === "asr:download-status") {
        setDownloadStates((current) => ({
          ...current,
          [event.payload.modelId]: {
            status: event.payload.status,
            progressPercent:
              event.payload.status === "ready"
                ? 100
                : current[event.payload.modelId]?.progressPercent ?? null,
          },
        }));

        if (event.payload.status === "ready" && desktopClientRef.current) {
          void refreshAsrSettings(desktopClientRef.current).catch(() => undefined);
        }
        return;
      }

      if (event.type === "asr:recognition-strategy") {
        setAsrSettings((current) => ({
          ...current,
          recognitionStrategy: event.payload,
        }));
      }
    },
    [refreshAsrSettings],
  );

  useEffect(() => {
    const client = getDesktopClient();
    let cancelled = false;

    desktopClientRef.current = client;
    setDesktopClient(client);

    const loadSettings = async () => {
      const [snapshot, nextAsrSettings] = await Promise.all([
        client.getSnapshot(),
        client.getAsrSettings(),
      ]);

      if (cancelled) {
        return;
      }

      setListening(snapshot.status.listening);
      setAsrSettings(nextAsrSettings);
    };

    const unsubscribe = client.subscribe((event) => {
      if (cancelled) {
        return;
      }
      applyRuntimeEvent(event);
    });

    void loadSettings().catch(() => undefined);

    return () => {
      cancelled = true;
      desktopClientRef.current = null;
      unsubscribe();
    };
  }, [applyRuntimeEvent]);

  const providerTransport = useMemo<ProviderManagerTransport | null>(() => {
    if (!desktopClient) {
      return null;
    }

    return {
      async listProviders() {
        const response = await desktopClient.listProviders();
        return response.providers;
      },
      createProvider(input) {
        return desktopClient.createProvider(input);
      },
      updateProvider(providerId, patch) {
        return desktopClient.updateProvider(providerId, patch);
      },
      deleteProvider(providerId) {
        return desktopClient.deleteProvider(providerId);
      },
      testProvider(providerId) {
        return desktopClient.testProvider(providerId);
      },
      activateProvider(providerId) {
        return desktopClient.activateProvider(providerId);
      },
    };
  }, [desktopClient]);

  const handleDownloadModel = useCallback(
    async (modelId: string) => {
      if (!desktopClient) {
        return;
      }

      setDownloadStates((current) => ({
        ...current,
        [modelId]: {
          status: "queued",
          progressPercent: 0,
        },
      }));

      await desktopClient.downloadAsrModel(modelId);
    },
    [desktopClient],
  );

  const handleActivateModel = useCallback(
    async (modelId: string) => {
      if (!desktopClient) {
        return;
      }

      await desktopClient.activateAsrModel(modelId);
      await refreshAsrSettings(desktopClient);
    },
    [desktopClient, refreshAsrSettings],
  );

  const handleDeleteModel = useCallback(
    async (modelId: string) => {
      if (!desktopClient) {
        return;
      }

      await desktopClient.deleteAsrModel(modelId);
      setDownloadStates((current) => ({
        ...current,
        [modelId]: undefined,
      }));
      await refreshAsrSettings(desktopClient);
    },
    [desktopClient, refreshAsrSettings],
  );

  const updateRecognitionStrategy = useCallback(
    async (nextStrategy: RecognitionStrategy) => {
      if (!desktopClient) {
        return;
      }

      const updated = await desktopClient.updateRecognitionStrategy(nextStrategy);
      setAsrSettings((current) => ({
        ...current,
        recognitionStrategy: updated,
      }));
    },
    [desktopClient],
  );

  const handleRecognitionModeChange = useCallback(
    (mode: RecognitionStrategy["mode"]) => {
      const currentFixedLanguage =
        asrSettings.recognitionStrategy.mode === "fixed"
          ? asrSettings.recognitionStrategy.fixedLanguage
          : "en";

      const nextStrategy: RecognitionStrategy =
        mode === "auto"
          ? { mode: "auto" }
          : { mode: "fixed", fixedLanguage: currentFixedLanguage };

      void updateRecognitionStrategy(nextStrategy).catch(() => undefined);
    },
    [asrSettings.recognitionStrategy, updateRecognitionStrategy],
  );

  const handleFixedLanguageChange = useCallback(
    (fixedLanguage: FixedLanguage) => {
      void updateRecognitionStrategy({ mode: "fixed", fixedLanguage }).catch(() => undefined);
    },
    [updateRecognitionStrategy],
  );

  return (
    <section className="grid gap-5">
      <header className="rounded-[1.75rem] border border-[color:var(--border)] bg-white/85 p-5">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">
          {t("settingsTitle")}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          {t("settingsDescription")}
        </p>
      </header>

      <SettingsLanguageSection locale={locale} onChangeLocale={setLocale} />
      <SettingsAsrModelSection
        catalog={asrSettings.catalog}
        installedModels={asrSettings.installedModels}
        downloadStates={downloadStates}
        listening={listening}
        onDownloadModel={(modelId) => {
          void handleDownloadModel(modelId).catch(() => undefined);
        }}
        onActivateModel={(modelId) => {
          void handleActivateModel(modelId).catch(() => undefined);
        }}
        onDeleteModel={(modelId) => {
          void handleDeleteModel(modelId).catch(() => undefined);
        }}
      />
        <SettingsRecognitionStrategySection
          value={asrSettings.recognitionStrategy}
          disabled={listening}
          onChangeMode={handleRecognitionModeChange}
          onChangeFixedLanguage={handleFixedLanguageChange}
        />
      {providerTransport ? <SettingsProviderSection transport={providerTransport} /> : null}
    </section>
  );
}
