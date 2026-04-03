import { describe, expect, test } from "vitest";
import { AsrErrorCodes, isAsrErrorCode } from "../errors.js";

describe("asr error contract", () => {
  test("includes model switch blocked while listening", () => {
    expect(AsrErrorCodes).toContain("ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING");
  });

  test("accepts model switch blocked while listening as an ASR error code", () => {
    expect(isAsrErrorCode("ASR_MODEL_SWITCH_BLOCKED_WHILE_LISTENING")).toBe(true);
  });
});
