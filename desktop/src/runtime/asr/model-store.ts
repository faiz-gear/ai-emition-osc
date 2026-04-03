import type { AsrErrorCode, InstalledAsrModel } from "@ai-emotion/contracts";
import type { AppConfigStore } from "../config/app-config-store";

export class ModelStoreError extends Error {
  public constructor(
    public readonly code: AsrErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ModelStoreError";
  }
}

export type ModelStore = {
  getModelsRootPath(): string;
  listInstalledModels(): Promise<InstalledAsrModel[]>;
  getActiveModelId(): Promise<string | null>;
  markModelReady(modelId: string, sizeBytes: number): Promise<InstalledAsrModel[]>;
  activateModel(modelId: string): Promise<InstalledAsrModel[]>;
  deleteModel(modelId: string): Promise<InstalledAsrModel[]>;
};

export type CreateModelStoreOptions = {
  appConfigStore: AppConfigStore;
  now?: () => Date;
};

export function createModelStore(options: CreateModelStoreOptions): ModelStore {
  const now = options.now ?? (() => new Date());

  return {
    getModelsRootPath() {
      return options.appConfigStore.getPaths().asrModelRootPath;
    },
    async listInstalledModels() {
      const config = await options.appConfigStore.read();
      return config.asr.installedModels.map((model) => ({ ...model }));
    },
    async getActiveModelId() {
      const config = await options.appConfigStore.read();
      return config.asr.currentModelId;
    },
    async markModelReady(modelId, sizeBytes) {
      const asrState = await options.appConfigStore.updateAsr((current) => {
        const withoutCurrent = current.installedModels.filter((item) => item.modelId !== modelId);
        const existing = current.installedModels.find((item) => item.modelId === modelId);

        const activeModelId =
          current.currentModelId && current.installedModels.some((item) => item.modelId === current.currentModelId)
            ? current.currentModelId
            : withoutCurrent.length === 0
              ? modelId
              : null;
        const resolvedActiveModelId = activeModelId ?? modelId;

        const entry: InstalledAsrModel = {
          modelId,
          installedAt: existing?.installedAt ?? now().toISOString(),
          sizeBytes,
          active: modelId === resolvedActiveModelId
        };

        const installedModels = sortModels([
          ...withoutCurrent.map((item) => ({
            ...item,
            active: item.modelId === resolvedActiveModelId
          })),
          entry
        ]);

        return {
          ...current,
          currentModelId: resolvedActiveModelId,
          installedModels
        };
      });

      return asrState.installedModels.map((model) => ({ ...model }));
    },
    async activateModel(modelId) {
      const asrState = await options.appConfigStore.updateAsr((current) => {
        if (!current.installedModels.some((item) => item.modelId === modelId)) {
          throw new ModelStoreError(
            "ASR_MODEL_NOT_INSTALLED",
            `Model ${modelId} is not installed`,
            { modelId }
          );
        }

        return {
          ...current,
          currentModelId: modelId,
          installedModels: current.installedModels.map((item) => ({
            ...item,
            active: item.modelId === modelId
          }))
        };
      });

      return asrState.installedModels.map((model) => ({ ...model }));
    },
    async deleteModel(modelId) {
      const asrState = await options.appConfigStore.updateAsr((current) => {
        const target = current.installedModels.find((item) => item.modelId === modelId);
        if (!target) {
          throw new ModelStoreError(
            "ASR_MODEL_NOT_INSTALLED",
            `Model ${modelId} is not installed`,
            { modelId }
          );
        }

        if (target.active || current.currentModelId === modelId) {
          throw new ModelStoreError(
            "ASR_ACTIVATION_FAILED",
            `Cannot delete active model ${modelId}`,
            {
              modelId,
              reason: "ACTIVE_MODEL_DELETE_BLOCKED"
            }
          );
        }

        return {
          ...current,
          installedModels: current.installedModels.filter((item) => item.modelId !== modelId)
        };
      });

      return asrState.installedModels.map((model) => ({ ...model }));
    }
  };
}

function sortModels(models: InstalledAsrModel[]): InstalledAsrModel[] {
  return [...models].sort((left, right) => left.modelId.localeCompare(right.modelId));
}
