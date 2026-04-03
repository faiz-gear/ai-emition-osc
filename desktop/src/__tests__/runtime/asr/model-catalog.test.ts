import { describe, expect, test } from "vitest";
import { listAsrModelCatalog } from "../../../runtime/asr/model-catalog";

describe("model catalog", () => {
  test("only exposes phase-one predefined models", () => {
    const catalog = listAsrModelCatalog();

    expect(catalog.map((item) => item.modelId)).toEqual([
      "whisper-large-v3-turbo",
      "whisper-tiny",
      "whisper-tiny-en",
      "whisper-base",
      "whisper-base-en",
      "whisper-small",
      "whisper-small-en",
      "whisper-medium",
      "whisper-medium-en",
      "whisper-large-v3"
    ]);
  });

  test("includes size, source URL, checksum, and description metadata", () => {
    const catalog = listAsrModelCatalog();

    for (const item of catalog) {
      expect(item.sizeBytes).toBeGreaterThan(0);
      expect(item.sourceUrl).toMatch(/^https?:\/\//);
      expect(item.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  test("marks only large v3 turbo as recommended", () => {
    const catalog = listAsrModelCatalog();

    expect(catalog.filter((item) => item.recommended).map((item) => item.modelId)).toEqual([
      "whisper-large-v3-turbo"
    ]);
  });

  test("includes english-only variants for tiny, base, small, and medium", () => {
    const catalog = listAsrModelCatalog();

    expect(catalog.filter((item) => item.language === "en").map((item) => item.modelId)).toEqual([
      "whisper-tiny-en",
      "whisper-base-en",
      "whisper-small-en",
      "whisper-medium-en"
    ]);
  });

  test("keeps the catalog ordered to match the desktop settings model list", () => {
    const catalog = listAsrModelCatalog();

    expect(catalog.map((item) => item.name)).toEqual([
      "Large V3 Turbo",
      "Tiny",
      "Tiny (English)",
      "Base",
      "Base (English)",
      "Small",
      "Small (English)",
      "Medium",
      "Medium (English)",
      "Large V3"
    ]);
  });

  test("uses model sizes aligned with current upstream artifacts", () => {
    const catalog = listAsrModelCatalog();
    const sizesById = Object.fromEntries(catalog.map((item) => [item.modelId, item.sizeBytes]));

    expect(sizesById).toMatchObject({
      "whisper-large-v3-turbo": 1_624_555_275,
      "whisper-tiny": 77_691_713,
      "whisper-tiny-en": 77_704_715,
      "whisper-base": 147_951_465,
      "whisper-base-en": 147_964_211,
      "whisper-small": 487_601_967,
      "whisper-small-en": 487_614_201,
      "whisper-medium": 1_533_763_059,
      "whisper-medium-en": 1_533_774_781,
      "whisper-large-v3": 3_095_033_483
    });
  });

  test("resolves official whisper.cpp download targets", () => {
    const catalog = listAsrModelCatalog();

    expect(Object.fromEntries(catalog.map((item) => [item.modelId, item.sourceUrl]))).toMatchObject({
      "whisper-large-v3-turbo":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
      "whisper-tiny":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
      "whisper-tiny-en":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
      "whisper-base":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
      "whisper-base-en":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
      "whisper-small":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
      "whisper-small-en":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
      "whisper-medium":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
      "whisper-medium-en":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin",
      "whisper-large-v3":
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
    });
  });

  test("stores current upstream etags as sha256 checksums", () => {
    const catalog = listAsrModelCatalog();

    expect(Object.fromEntries(catalog.map((item) => [item.modelId, item.checksumSha256]))).toMatchObject({
      "whisper-large-v3-turbo": "5a4b65b05933d70ce9d5aa6265eb128fa5eba38f6fee40836fdedc4d2fde42ad",
      "whisper-tiny": "518970a29bedb265f23ac48d486ddbc63bedffd90967b10140ae5ac61243acf3",
      "whisper-tiny-en": "0d686a2a6a22b02da2ef3101d4c86e68461363a623c58f27f81b1b2d36b42317",
      "whisper-base": "2f62d18b50c3f3feafbf990eec23a93d319660b1efbdd3fff55e52b7cde2e374",
      "whisper-base-en": "ff7d10f8526045d48149699b43aeaa014e4b337239bc5a35251116fc179aabcf",
      "whisper-small": "edd29d67e70b000132af65205b99bb774b77abc13d10103e14f80ce2242913e1",
      "whisper-small-en": "0d57184d34ae7d736e5bb2db5bf83debe730bd53dcefa235a0979b9dcfd33fb3",
      "whisper-medium": "d3d5696e6a3e0ca2aa08eb31cad208ffa1e87b3cc341f59e628fbdcf8122de9b",
      "whisper-medium-en": "a163589aa264d5188df3b05ed4eac56bfd97e26910f207809d869f7e99886fd2",
      "whisper-large-v3": "766d11cebbdf5a67c179c5774e2642b609e35e1a30240e7b559d5647c655b0a4"
    });
  });
});
