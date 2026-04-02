import { describe, expect, test } from "vitest";
import { listAsrModelCatalog } from "../../../runtime/asr/model-catalog";

describe("model catalog", () => {
  test("only exposes phase-one predefined models", () => {
    const catalog = listAsrModelCatalog();

    expect(catalog.map((item) => item.modelId)).toEqual([
      "whisper-tiny",
      "whisper-base",
      "whisper-small"
    ]);
  });

  test("includes size, source URL, checksum, and multilingual note metadata", () => {
    const catalog = listAsrModelCatalog();

    for (const item of catalog) {
      expect(item.sizeBytes).toBeGreaterThan(0);
      expect(item.sourceUrl).toMatch(/^https?:\/\//);
      expect(item.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(item.multilingualNote.toLowerCase()).toContain("multilingual");
    }
  });
});
