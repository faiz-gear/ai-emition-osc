import { expect, test } from "vitest";
import {
  AsrErrorCode,
  DesktopCommand,
  DesktopEventChannel,
  ProviderErrorCode,
  RecognitionStrategy,
  RuntimeSnapshot,
  RuntimeEvent,
  isFixedLanguage,
  isRecognitionStrategy
} from "../index";

test("desktop commands remain stable", () => {
  expect(DesktopCommand.StartListening).toBe("session:start-listening");
  expect(DesktopCommand.StopListening).toBe("session:stop-listening");
  expect(DesktopCommand.GetRuntimeSnapshot).toBe("runtime:get-snapshot");
  expect(DesktopCommand.ListAsrModelCatalog).toBe("asr:list-model-catalog");
  expect(DesktopCommand.ListInstalledAsrModels).toBe("asr:list-installed-models");
  expect(DesktopCommand.DownloadAsrModel).toBe("asr:download-model");
  expect(DesktopCommand.ActivateAsrModel).toBe("asr:activate-model");
  expect(DesktopCommand.DeleteAsrModel).toBe("asr:delete-model");
  expect(DesktopCommand.GetRecognitionStrategy).toBe("asr:get-recognition-strategy");
  expect(DesktopCommand.UpdateRecognitionStrategy).toBe("asr:update-recognition-strategy");
  expect(DesktopCommand.ListProviders).toBe("providers:list");
  expect(DesktopCommand.CreateProvider).toBe("providers:create");
  expect(DesktopCommand.UpdateProvider).toBe("providers:update");
  expect(DesktopCommand.DeleteProvider).toBe("providers:delete");
  expect(DesktopCommand.TestProvider).toBe("providers:test");
  expect(DesktopCommand.ActivateProvider).toBe("providers:activate");
  expect(DesktopEventChannel.RuntimeEvent).toBe("runtime:event");
});

test("fixed language guard accepts only zh and en", () => {
  expect(isFixedLanguage("zh")).toBe(true);
  expect(isFixedLanguage("en")).toBe(true);
  expect(isFixedLanguage("ja")).toBe(false);
});

test("recognition strategy supports auto and fixed zh/en", () => {
  const autoStrategy: RecognitionStrategy = { mode: "auto" };
  const fixedZh: RecognitionStrategy = { mode: "fixed", fixedLanguage: "zh" };
  const fixedEn: RecognitionStrategy = { mode: "fixed", fixedLanguage: "en" };

  expect(isRecognitionStrategy(autoStrategy)).toBe(true);
  expect(isRecognitionStrategy(fixedZh)).toBe(true);
  expect(isRecognitionStrategy(fixedEn)).toBe(true);
  expect(isRecognitionStrategy({ mode: "fixed", fixedLanguage: "ja" })).toBe(false);
});

test("runtime events are discriminated by type", () => {
  const event: RuntimeEvent = {
    type: "asr:download-progress",
    payload: {
      modelId: "ggml-base",
      receivedBytes: 50,
      totalBytes: 100
    }
  };

  if (event.type === "asr:download-progress") {
    expect(event.payload.totalBytes).toBe(100);
  }
});

test("runtime snapshot carries the reducer baseline state", () => {
  const snapshot: RuntimeSnapshot = {
    status: { listening: false },
    metrics: {
      uptime_seconds: 0,
      ws_clients: 0,
      utterances_total: 0,
      emotion_total: 0,
      errors_total: 0
    },
    utterances: []
  };

  expect(snapshot.status.listening).toBe(false);
  expect(snapshot.utterances).toHaveLength(0);
});

test("provider and asr error codes are exported from one place", () => {
  const providerCode: ProviderErrorCode = "PROVIDER_RATE_LIMITED";
  const asrCode: AsrErrorCode = "ASR_MODEL_NOT_FOUND";
  expect(providerCode).toBe("PROVIDER_RATE_LIMITED");
  expect(asrCode).toBe("ASR_MODEL_NOT_FOUND");
});
