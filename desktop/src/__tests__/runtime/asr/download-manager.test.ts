import { once } from "node:events";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAppConfigStore } from "../../../runtime/config/app-config-store";
import { createModelStore } from "../../../runtime/asr/model-store";
import {
  createDownloadManager,
  type DownloadManagerEvent,
  type DownloadStatus
} from "../../../runtime/asr/download-manager";
import type { AsrModelCatalogEntry } from "../../../runtime/asr/model-catalog";

type TestElectronApp = {
  getPath(name: "appData" | "userData"): string;
  getAppPath(): string;
};

describe("download manager", () => {
  const sandboxes: string[] = [];
  const modelPayload = Buffer.from("fake-whisper-model-binary", "utf8");
  let server: Server;
  let baseUrl = "";

  beforeEach(async () => {
    server = createServer((request, response) => {
      if (request.url === "/tiny.bin" || request.url === "/small.bin") {
        response.statusCode = 200;
        response.setHeader("content-length", String(modelPayload.byteLength));
        response.end(modelPayload);
        return;
      }

      response.statusCode = 404;
      response.end();
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected an ephemeral server address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    await Promise.all(
      sandboxes.splice(0).map((sandboxPath) =>
        rm(sandboxPath, { recursive: true, force: true })
      )
    );
  });

  async function createHarness() {
    const sandboxPath = await mkdtemp(join(tmpdir(), "asr-download-manager-test-"));
    sandboxes.push(sandboxPath);
    const appDataPath = join(sandboxPath, "app-data");
    const userDataPath = join(sandboxPath, "user-data");

    const fakeApp: TestElectronApp = {
      getPath(name) {
        return name === "appData" ? appDataPath : userDataPath;
      },
      getAppPath() {
        return "/Applications/AI Emotion.app/Contents/Resources/app.asar";
      }
    };

    const appConfigStore = createAppConfigStore({ app: fakeApp });
    const modelStore = createModelStore({ appConfigStore });
    const events: DownloadManagerEvent[] = [];
    const checksum = createHash("sha256").update(modelPayload).digest("hex");
    const catalog: AsrModelCatalogEntry[] = [
      {
        modelId: "whisper-tiny",
        name: "Whisper Tiny",
        language: "multilingual",
        sizeBytes: modelPayload.byteLength,
        sourceUrl: `${baseUrl}/tiny.bin`,
        checksumSha256: checksum,
        multilingualNote: "Multilingual general-purpose recognition"
      },
      {
        modelId: "whisper-small",
        name: "Whisper Small",
        language: "multilingual",
        sizeBytes: modelPayload.byteLength,
        sourceUrl: `${baseUrl}/small.bin`,
        checksumSha256: "0000000000000000000000000000000000000000000000000000000000000000",
        multilingualNote: "Multilingual higher-accuracy recognition"
      }
    ];
    const downloadManager = createDownloadManager({
      catalog,
      modelStore,
      eventSink(event) {
        events.push(event);
      }
    });

    return {
      appConfigStore,
      modelStore,
      downloadManager,
      events
    };
  }

  test("emits queued/downloading/verifying/ready and failed status transitions with progress", async () => {
    const { downloadManager, events } = await createHarness();

    await downloadManager.downloadModel("whisper-tiny");

    const successStatuses = events
      .filter((event): event is Extract<DownloadManagerEvent, { type: "asr:download-status" }> =>
        event.type === "asr:download-status"
      )
      .map((event) => event.payload.status);
    expect(successStatuses).toEqual<DownloadStatus[]>([
      "queued",
      "downloading",
      "verifying",
      "ready"
    ]);

    const progressEvents = events.filter(
      (event): event is Extract<DownloadManagerEvent, { type: "asr:download-progress" }> =>
        event.type === "asr:download-progress"
    );
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents.at(-1)?.payload.receivedBytes).toBe(modelPayload.byteLength);

    events.length = 0;
    await expect(downloadManager.downloadModel("whisper-small")).rejects.toMatchObject({
      code: "ASR_DOWNLOAD_FAILED"
    });

    const failedStatuses = events
      .filter((event): event is Extract<DownloadManagerEvent, { type: "asr:download-status" }> =>
        event.type === "asr:download-status"
      )
      .map((event) => event.payload.status);
    expect(failedStatuses).toEqual<DownloadStatus[]>([
      "queued",
      "downloading",
      "verifying",
      "failed"
    ]);
  });

  test("blocks deleting the active model with a stable error code", async () => {
    const { appConfigStore, modelStore, downloadManager } = await createHarness();

    await downloadManager.downloadModel("whisper-tiny");

    await expect(modelStore.deleteModel("whisper-tiny")).rejects.toMatchObject({
      code: "ASR_ACTIVATION_FAILED"
    });

    const config = await appConfigStore.read();
    expect(config.asr.currentModelId).toBe("whisper-tiny");

    const modelFiles = await readdir(appConfigStore.getPaths().asrModelRootPath);
    expect(modelFiles.some((fileName) => fileName.includes("whisper-tiny"))).toBe(true);
    expect(modelFiles.some((fileName) => fileName.includes("whisper-small"))).toBe(false);
    expect(modelFiles.some((fileName) => fileName.includes("partial"))).toBe(false);
  });
});
