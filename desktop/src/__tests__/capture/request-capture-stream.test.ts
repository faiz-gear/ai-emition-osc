import { describe, expect, test, vi } from "vitest";
import { requestCaptureStream } from "../../capture/request-capture-stream";

describe("requestCaptureStream", () => {
  test("requests microphone access with audio enabled", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn(async () => stream);

    await expect(
      requestCaptureStream({
        getUserMedia
      })
    ).resolves.toBe(stream);

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
  });
});
