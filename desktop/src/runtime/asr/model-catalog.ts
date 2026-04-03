import type { AsrModelCatalogItem } from "@ai-emotion/contracts";

export type AsrModelCatalogEntry = AsrModelCatalogItem & {
  sourceUrl: string;
  checksumSha256: string;
  description: string;
};

const PHASE_ONE_MODEL_CATALOG: readonly AsrModelCatalogEntry[] = [
  {
    modelId: "whisper-large-v3-turbo",
    name: "Large V3 Turbo",
    language: "multilingual",
    sizeBytes: 1_624_555_275,
    recommended: true,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
    checksumSha256: "5a4b65b05933d70ce9d5aa6265eb128fa5eba38f6fee40836fdedc4d2fde42ad",
    description: "Fast and accurate, best choice."
  },
  {
    modelId: "whisper-tiny",
    name: "Tiny",
    language: "multilingual",
    sizeBytes: 77_691_713,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
    checksumSha256: "518970a29bedb265f23ac48d486ddbc63bedffd90967b10140ae5ac61243acf3",
    description: "Fastest, lowest accuracy."
  },
  {
    modelId: "whisper-tiny-en",
    name: "Tiny (English)",
    language: "en",
    sizeBytes: 77_704_715,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
    checksumSha256: "0d686a2a6a22b02da2ef3101d4c86e68461363a623c58f27f81b1b2d36b42317",
    description: "English only, fastest."
  },
  {
    modelId: "whisper-base",
    name: "Base",
    language: "multilingual",
    sizeBytes: 147_951_465,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
    checksumSha256: "2f62d18b50c3f3feafbf990eec23a93d319660b1efbdd3fff55e52b7cde2e374",
    description: "Good balance for daily use."
  },
  {
    modelId: "whisper-base-en",
    name: "Base (English)",
    language: "en",
    sizeBytes: 147_964_211,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
    checksumSha256: "ff7d10f8526045d48149699b43aeaa014e4b337239bc5a35251116fc179aabcf",
    description: "English only, balanced."
  },
  {
    modelId: "whisper-small",
    name: "Small",
    language: "multilingual",
    sizeBytes: 487_601_967,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
    checksumSha256: "edd29d67e70b000132af65205b99bb774b77abc13d10103e14f80ce2242913e1",
    description: "Good for most users."
  },
  {
    modelId: "whisper-small-en",
    name: "Small (English)",
    language: "en",
    sizeBytes: 487_614_201,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
    checksumSha256: "0d57184d34ae7d736e5bb2db5bf83debe730bd53dcefa235a0979b9dcfd33fb3",
    description: "English only, good accuracy."
  },
  {
    modelId: "whisper-medium",
    name: "Medium",
    language: "multilingual",
    sizeBytes: 1_533_763_059,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
    checksumSha256: "d3d5696e6a3e0ca2aa08eb31cad208ffa1e87b3cc341f59e628fbdcf8122de9b",
    description: "High accuracy."
  },
  {
    modelId: "whisper-medium-en",
    name: "Medium (English)",
    language: "en",
    sizeBytes: 1_533_774_781,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin",
    checksumSha256: "a163589aa264d5188df3b05ed4eac56bfd97e26910f207809d869f7e99886fd2",
    description: "English only, high accuracy."
  },
  {
    modelId: "whisper-large-v3",
    name: "Large V3",
    language: "multilingual",
    sizeBytes: 3_095_033_483,
    sourceUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
    checksumSha256: "766d11cebbdf5a67c179c5774e2642b609e35e1a30240e7b559d5647c655b0a4",
    description: "Best accuracy, slowest."
  }
] as const;

export function listAsrModelCatalog(): AsrModelCatalogEntry[] {
  return PHASE_ONE_MODEL_CATALOG.map((item) => ({ ...item }));
}

export function getAsrModelCatalogEntry(modelId: string): AsrModelCatalogEntry | null {
  const match = PHASE_ONE_MODEL_CATALOG.find((item) => item.modelId === modelId);
  return match ? { ...match } : null;
}
