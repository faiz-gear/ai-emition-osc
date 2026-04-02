import type { AsrModelCatalogItem } from "@ai-emotion/contracts";

export type AsrModelCatalogEntry = AsrModelCatalogItem & {
  sourceUrl: string;
  checksumSha256: string;
  multilingualNote: string;
};

const PHASE_ONE_MODEL_CATALOG: readonly AsrModelCatalogEntry[] = [
  {
    modelId: "whisper-tiny",
    name: "Whisper Tiny",
    language: "multilingual",
    sizeBytes: 75_000_000,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
    checksumSha256: "326b7d8d66ce65f6d6f6a00bda633ecf5f4f2da0a7a9d95f2d6f6e31f3fe6ea1",
    multilingualNote: "Multilingual model optimized for low-latency local recognition."
  },
  {
    modelId: "whisper-base",
    name: "Whisper Base",
    language: "multilingual",
    sizeBytes: 146_000_000,
    recommended: true,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    checksumSha256: "60ed5bc1749f4a06bb6ff24f68f9f5bff031f12f954ed7be35d8aacbb44e0a13",
    multilingualNote: "Multilingual default balance between quality and speed."
  },
  {
    modelId: "whisper-small",
    name: "Whisper Small",
    language: "multilingual",
    sizeBytes: 488_000_000,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    checksumSha256: "8e9f2a5c0b8b4ca9f89d2ba9f06f26cf73f2dc16d8dfafad9dca7eac191f8563",
    multilingualNote: "Multilingual higher-accuracy model with larger local footprint."
  }
] as const;

export function listAsrModelCatalog(): AsrModelCatalogEntry[] {
  return PHASE_ONE_MODEL_CATALOG.map((item) => ({ ...item }));
}

export function getAsrModelCatalogEntry(modelId: string): AsrModelCatalogEntry | null {
  const match = PHASE_ONE_MODEL_CATALOG.find((item) => item.modelId === modelId);
  return match ? { ...match } : null;
}
