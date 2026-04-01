export type FixedLanguage = "zh" | "en";
export type RecognitionLanguage = "auto" | FixedLanguage;

export type RecognitionStrategy =
  | { mode: "auto" }
  | { mode: "fixed"; language: FixedLanguage };

export const isFixedLanguage = (value: string): value is FixedLanguage =>
  value === "zh" || value === "en";

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
