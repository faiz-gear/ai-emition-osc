import { expect, test } from "vitest";
import {
  AsrErrorCode,
  DesktopCommand,
  ProviderErrorCode,
  RuntimeEvent,
  isFixedLanguage
} from "../index";

test("desktop commands remain stable", () => {
  expect(DesktopCommand.StartListening).toBe("session:start-listening");
  expect(DesktopCommand.StopListening).toBe("session:stop-listening");
  expect(DesktopCommand.DownloadAsrModel).toBe("asr:download-model");
  expect(DesktopCommand.ActivateAsrModel).toBe("asr:activate-model");
  expect(DesktopCommand.UpdateRecognitionStrategy).toBe("asr:update-recognition-strategy");
  expect(DesktopCommand.ListProviders).toBe("providers:list");
});

test("fixed language guard accepts only zh and en", () => {
  expect(isFixedLanguage("zh")).toBe(true);
  expect(isFixedLanguage("en")).toBe(true);
  expect(isFixedLanguage("ja")).toBe(false);
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

test("provider and asr error codes are exported from one place", () => {
  const providerCode: ProviderErrorCode = "PROVIDER_RATE_LIMITED";
  const asrCode: AsrErrorCode = "ASR_MODEL_NOT_FOUND";
  expect(providerCode).toBe("PROVIDER_RATE_LIMITED");
  expect(asrCode).toBe("ASR_MODEL_NOT_FOUND");
});
