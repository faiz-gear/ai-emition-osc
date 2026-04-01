export type FixedLanguage = "zh" | "en";
export type RecognitionLanguage = "auto" | FixedLanguage;

export type RecognitionStrategy =
  | { mode: "auto" }
  | { mode: "fixed"; fixedLanguage: FixedLanguage };

export const isFixedLanguage = (value: string): value is FixedLanguage =>
  value === "zh" || value === "en";

export const isRecognitionStrategy = (value: unknown): value is RecognitionStrategy => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { mode?: unknown; fixedLanguage?: unknown };

  if (candidate.mode === "auto") {
    return true;
  }

  if (candidate.mode === "fixed") {
    return typeof candidate.fixedLanguage === "string" && isFixedLanguage(candidate.fixedLanguage);
  }

  return false;
};

export type AsrModelCatalogItem = {
  modelId: string;
  name: string;
  language: "multilingual" | FixedLanguage;
  sizeBytes: number;
  recommended?: boolean;
};

export type InstalledAsrModel = {
  modelId: string;
  installedAt: string;
  sizeBytes: number;
  active: boolean;
};

export type DownloadProgressEvent = {
  modelId: string;
  receivedBytes: number;
  totalBytes: number;
};
