import type { DownloadProgressEvent, RecognitionStrategy } from "./asr";
import type { Metrics, ProviderSummary, Utterance } from "./domain";
import type { DesktopErrorCode } from "./errors";

export const DesktopCommand = {
  StartListening: "session:start-listening",
  StopListening: "session:stop-listening",
  DownloadAsrModel: "asr:download-model",
  ActivateAsrModel: "asr:activate-model",
  UpdateRecognitionStrategy: "asr:update-recognition-strategy",
  ListProviders: "providers:list"
} as const;

export type DesktopCommandName = (typeof DesktopCommand)[keyof typeof DesktopCommand];

export type RuntimeEvent =
  | { type: "runtime:status"; payload: { listening: boolean } }
  | { type: "runtime:metrics"; payload: Metrics }
  | { type: "runtime:utterance"; payload: Utterance }
  | { type: "providers:list"; payload: { providers: ProviderSummary[] } }
  | { type: "asr:download-progress"; payload: DownloadProgressEvent }
  | { type: "asr:recognition-strategy"; payload: RecognitionStrategy }
  | { type: "runtime:error"; payload: { code: DesktopErrorCode; message: string } };
