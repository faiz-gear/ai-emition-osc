import * as electron from "electron";
import {
  DesktopCommand,
  type AsrModelCatalogItem,
  type CreateProviderRequest,
  type DesktopCommandName,
  type DesktopCommandPayloadMap,
  type DesktopCommandResponseMap,
  type InstalledAsrModel,
  type ListProvidersResponse,
  type PatchProviderRequest,
  type ProviderSummary,
  type ProviderTestResult,
  type RecognitionStrategy,
  type RuntimeEvent,
  type RuntimeSnapshot
} from "@ai-emotion/contracts";
import { createRuntimeEventBus } from "./runtime-bus";
import { invokeValidators } from "./validators";

export type DesktopIpcServices = {
  session: {
    startListening(): Promise<void>;
    stopListening(): Promise<void>;
  };
  runtime: {
    getSnapshot(): Promise<RuntimeSnapshot>;
    subscribe(listener: (event: RuntimeEvent) => void): () => void;
  };
  asr: {
    listCatalog(): Promise<AsrModelCatalogItem[]>;
    listInstalled(): Promise<InstalledAsrModel[]>;
    downloadModel(modelId: string): Promise<void>;
    activateModel(modelId: string): Promise<void>;
    deleteModel(modelId: string): Promise<void>;
    getRecognitionStrategy(): Promise<RecognitionStrategy>;
    updateRecognitionStrategy(input: RecognitionStrategy): Promise<RecognitionStrategy>;
  };
  providers: {
    list(): Promise<ListProvidersResponse>;
    create(input: CreateProviderRequest): Promise<ProviderSummary>;
    update(providerId: string, patch: PatchProviderRequest): Promise<ProviderSummary>;
    delete(providerId: string): Promise<void>;
    test(providerId: string): Promise<ProviderTestResult>;
    activate(providerId: string): Promise<void>;
  };
};

type DefaultRuntimeState = {
  listening: boolean;
  recognitionStrategy: RecognitionStrategy;
  installedModels: InstalledAsrModel[];
  providers: ProviderSummary[];
};

const runtimeEventBus = createRuntimeEventBus();
const asrCatalog: AsrModelCatalogItem[] = [
  {
    modelId: "whisper-base",
    name: "Whisper Base",
    language: "multilingual",
    sizeBytes: 146_000_000,
    recommended: true
  }
];

let defaultServices: DesktopIpcServices | undefined;

function createDefaultServices(): DesktopIpcServices {
  const state: DefaultRuntimeState = {
    listening: false,
    recognitionStrategy: { mode: "auto" },
    installedModels: [],
    providers: []
  };

  const metrics = {
    uptime_seconds: 0,
    ws_clients: 0,
    utterances_total: 0,
    emotion_total: 0,
    errors_total: 0
  };

  const snapshot = (): RuntimeSnapshot => ({
    status: { listening: state.listening },
    metrics,
    utterances: []
  });

  return {
    session: {
      async startListening() {
        state.listening = true;
        runtimeEventBus.publish({
          type: "runtime:status",
          payload: { listening: true }
        });
      },
      async stopListening() {
        state.listening = false;
        runtimeEventBus.publish({
          type: "runtime:status",
          payload: { listening: false }
        });
      }
    },
    runtime: {
      async getSnapshot() {
        return snapshot();
      },
      subscribe(listener) {
        return runtimeEventBus.subscribe(listener);
      }
    },
    asr: {
      async listCatalog() {
        return [...asrCatalog];
      },
      async listInstalled() {
        return [...state.installedModels];
      },
      async downloadModel(modelId) {
        const catalogItem = asrCatalog.find((item) => item.modelId === modelId);
        if (!catalogItem) {
          throw new Error(`Unknown model: ${modelId}`);
        }

        if (!state.installedModels.some((item) => item.modelId === modelId)) {
          state.installedModels = [
            ...state.installedModels,
            {
              modelId,
              installedAt: new Date().toISOString(),
              sizeBytes: catalogItem.sizeBytes,
              active: state.installedModels.length === 0
            }
          ];
        }
      },
      async activateModel(modelId) {
        state.installedModels = state.installedModels.map((item) => ({
          ...item,
          active: item.modelId === modelId
        }));
      },
      async deleteModel(modelId) {
        state.installedModels = state.installedModels.filter((item) => item.modelId !== modelId);
      },
      async getRecognitionStrategy() {
        return state.recognitionStrategy;
      },
      async updateRecognitionStrategy(input) {
        state.recognitionStrategy = input;
        runtimeEventBus.publish({
          type: "asr:recognition-strategy",
          payload: input
        });
        return state.recognitionStrategy;
      }
    },
    providers: {
      async list() {
        return { providers: [...state.providers] };
      },
      async create(input) {
        const provider: ProviderSummary = {
          id: `provider-${state.providers.length + 1}`,
          name: input.name,
          provider_type: input.provider_type,
          provider_key: input.provider_key ?? null,
          model: input.model,
          base_url: input.base_url ?? null,
          temperature: input.temperature ?? null,
          is_active: state.providers.length === 0,
          updated_at: new Date().toISOString(),
          has_api_key: Boolean(input.api_key),
          headers_keys: input.headers ? Object.keys(input.headers) : null,
          status: "ok",
          error_code: null,
          error_message: null
        };
        state.providers = [...state.providers, provider];
        runtimeEventBus.publish({
          type: "providers:list",
          payload: { providers: [...state.providers] }
        });
        return provider;
      },
      async update(providerId, patch) {
        const current = state.providers.find((provider) => provider.id === providerId);
        if (!current) {
          throw new Error(`Unknown provider: ${providerId}`);
        }

        const updated: ProviderSummary = {
          ...current,
          ...patch,
          updated_at: new Date().toISOString(),
          has_api_key: patch.api_key !== undefined ? Boolean(patch.api_key) : current.has_api_key,
          headers_keys: patch.headers
            ? Object.keys(patch.headers)
            : patch.headers === null
              ? null
              : current.headers_keys
        };
        state.providers = state.providers.map((provider) =>
          provider.id === providerId ? updated : provider
        );
        runtimeEventBus.publish({
          type: "providers:list",
          payload: { providers: [...state.providers] }
        });
        return updated;
      },
      async delete(providerId) {
        state.providers = state.providers.filter((provider) => provider.id !== providerId);
        runtimeEventBus.publish({
          type: "providers:list",
          payload: { providers: [...state.providers] }
        });
      },
      async test() {
        return {
          ok: true,
          latency_ms: 25
        };
      },
      async activate(providerId) {
        state.providers = state.providers.map((provider) => ({
          ...provider,
          is_active: provider.id === providerId
        }));
        runtimeEventBus.publish({
          type: "providers:list",
          payload: { providers: [...state.providers] }
        });
      }
    }
  };
}

function getDefaultServices(): DesktopIpcServices {
  if (!defaultServices) {
    defaultServices = createDefaultServices();
  }

  return defaultServices;
}

function registerHandler<K extends DesktopCommandName>(
  commandName: K,
  handler: (
    payload: DesktopCommandPayloadMap[K]
  ) => Promise<DesktopCommandResponseMap[K]> | DesktopCommandResponseMap[K]
): void {
  electron.ipcMain?.handle?.(commandName, async (_event, rawPayload) => {
    const validatedPayload = invokeValidators[commandName](rawPayload);
    return handler(validatedPayload);
  });
}

export function registerIpc(services: DesktopIpcServices = getDefaultServices()): void {
  registerHandler(DesktopCommand.StartListening, async () => {
    await services.session.startListening();
  });

  registerHandler(DesktopCommand.StopListening, async () => {
    await services.session.stopListening();
  });

  registerHandler(DesktopCommand.GetRuntimeSnapshot, () => services.runtime.getSnapshot());
  registerHandler(DesktopCommand.ListAsrModelCatalog, () => services.asr.listCatalog());
  registerHandler(DesktopCommand.ListInstalledAsrModels, () => services.asr.listInstalled());
  registerHandler(DesktopCommand.DownloadAsrModel, async ({ modelId }) => {
    await services.asr.downloadModel(modelId);
  });
  registerHandler(DesktopCommand.ActivateAsrModel, async ({ modelId }) => {
    await services.asr.activateModel(modelId);
  });
  registerHandler(DesktopCommand.DeleteAsrModel, async ({ modelId }) => {
    await services.asr.deleteModel(modelId);
  });
  registerHandler(DesktopCommand.GetRecognitionStrategy, () =>
    services.asr.getRecognitionStrategy()
  );
  registerHandler(DesktopCommand.UpdateRecognitionStrategy, (payload) =>
    services.asr.updateRecognitionStrategy(payload)
  );
  registerHandler(DesktopCommand.ListProviders, () => services.providers.list());
  registerHandler(DesktopCommand.CreateProvider, (payload) =>
    services.providers.create(payload)
  );
  registerHandler(DesktopCommand.UpdateProvider, ({ providerId, patch }) =>
    services.providers.update(providerId, patch)
  );
  registerHandler(DesktopCommand.DeleteProvider, async ({ providerId }) => {
    await services.providers.delete(providerId);
  });
  registerHandler(DesktopCommand.TestProvider, (payload) =>
    services.providers.test(payload.providerId)
  );
  registerHandler(DesktopCommand.ActivateProvider, async ({ providerId }) => {
    await services.providers.activate(providerId);
  });
}
