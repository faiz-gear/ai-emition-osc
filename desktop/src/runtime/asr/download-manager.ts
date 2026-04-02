import { createHash } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type {
  AsrErrorCode,
  DownloadStatus,
  DownloadStatusEvent,
  RuntimeEvent
} from "@ai-emotion/contracts";
import { getAsrModelCatalogEntry, listAsrModelCatalog, type AsrModelCatalogEntry } from "./model-catalog";
import type { ModelStore } from "./model-store";

export type RuntimeEventPublisher = {
  publish(event: RuntimeEvent): void;
};

export class DownloadManagerError extends Error {
  public constructor(
    public readonly code: AsrErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "DownloadManagerError";
  }
}

export type DownloadManager = {
  downloadModel(modelId: string): Promise<void>;
};

export type CreateDownloadManagerOptions = {
  modelStore: ModelStore;
  catalog?: AsrModelCatalogEntry[];
  fetchImpl?: typeof fetch;
  runtimeEventBus?: RuntimeEventPublisher;
};

export function createDownloadManager(options: CreateDownloadManagerOptions): DownloadManager {
  const fetchImpl = options.fetchImpl ?? fetch;
  const catalog = options.catalog ?? listAsrModelCatalog();
  const catalogById = new Map(catalog.map((item) => [item.modelId, item] as const));

  return {
    async downloadModel(modelId: string) {
      const model = catalogById.get(modelId) ?? getAsrModelCatalogEntry(modelId);
      const emitStatus = createStatusEmitter(modelId, options.runtimeEventBus);

      emitStatus("queued");

      if (!model) {
        const error = new DownloadManagerError(
          "ASR_MODEL_NOT_FOUND",
          `Model ${modelId} is not in the catalog`,
          { modelId }
        );
        emitStatus("failed", error);
        throw error;
      }

      const modelRootPath = options.modelStore.getModelsRootPath();
      const modelFilePath = join(modelRootPath, `${model.modelId}.bin`);
      const partialFilePath = `${modelFilePath}.partial`;
      let movedToFinalPath = false;

      try {
        await mkdir(modelRootPath, { recursive: true });
        emitStatus("downloading");
        const response = await fetchImpl(model.sourceUrl);
        if (!response.ok) {
          throw new DownloadManagerError("ASR_DOWNLOAD_FAILED", "Failed to download model", {
            modelId,
            sourceUrl: model.sourceUrl,
            status: response.status
          });
        }
        if (!response.body) {
          throw new DownloadManagerError("ASR_DOWNLOAD_FAILED", "Model download body is empty", {
            modelId,
            sourceUrl: model.sourceUrl
          });
        }

        const totalBytesHeader = response.headers.get("content-length");
        const parsedTotalBytes = totalBytesHeader ? Number.parseInt(totalBytesHeader, 10) : NaN;
        const totalBytes = Number.isFinite(parsedTotalBytes) ? parsedTotalBytes : model.sizeBytes;
        const hash = createHash("sha256");
        let receivedBytes = 0;

        const handle = await open(partialFilePath, "w");
        try {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            const chunk = Buffer.from(value);
            receivedBytes += chunk.byteLength;
            hash.update(chunk);
            await handle.write(chunk);
            options.runtimeEventBus?.publish({
              type: "asr:download-progress",
              payload: {
                modelId,
                receivedBytes,
                totalBytes
              }
            });
          }
        } finally {
          await handle.close();
        }

        emitStatus("verifying");
        const digest = hash.digest("hex").toLowerCase();
        if (digest !== model.checksumSha256.toLowerCase()) {
          throw new DownloadManagerError("ASR_DOWNLOAD_FAILED", "Downloaded model checksum mismatch", {
            modelId,
            expectedChecksum: model.checksumSha256,
            actualChecksum: digest,
            reason: "CHECKSUM_MISMATCH"
          });
        }

        await rename(partialFilePath, modelFilePath);
        movedToFinalPath = true;
        await options.modelStore.markModelReady(modelId, model.sizeBytes);
        emitStatus("ready");
      } catch (error) {
        const downloadError = mapDownloadError(error, modelId);
        await safeRemove(partialFilePath);
        if (movedToFinalPath) {
          await safeRemove(modelFilePath);
        }
        emitStatus("failed", downloadError);
        throw downloadError;
      }
    }
  };
}

function mapDownloadError(error: unknown, modelId: string): DownloadManagerError {
  if (error instanceof DownloadManagerError) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unexpected download failure";
  return new DownloadManagerError("ASR_DOWNLOAD_FAILED", message, { modelId }, { cause: error });
}

function createStatusEmitter(
  modelId: string,
  runtimeEventBus?: RuntimeEventPublisher
): (status: DownloadStatus, error?: DownloadManagerError) => void {
  return (status, error) => {
    const payload: DownloadStatusEvent = {
      modelId,
      status
    };

    if (error?.code) {
      payload.errorCode = error.code;
    }
    if (error?.message) {
      payload.message = error.message;
    }

    runtimeEventBus?.publish({ type: "asr:download-status", payload });
  };
}

async function safeRemove(path: string): Promise<void> {
  try {
    await rm(path, { force: true });
  } catch {
    // best-effort cleanup to avoid leaking partial artifacts
  }
}
