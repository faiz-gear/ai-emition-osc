import type {
  AsrModelCatalogItem,
  DownloadProgressEvent,
  DownloadStatusEvent,
  InstalledAsrModel,
  RecognitionStrategy
} from "./asr.js";
import type { EmotionResult, Metrics, ProviderSummary, Utterance } from "./domain.js";
import type { DesktopErrorCode } from "./errors.js";
import type {
  CreateProviderRequest,
  ListProvidersResponse,
  PatchProviderRequest,
  ProviderTestResult
} from "./providers.js";

export const DesktopCommand = {
  StartListening: "session:start-listening",
  StopListening: "session:stop-listening",
  GetRuntimeSnapshot: "runtime:get-snapshot",
  ListAsrModelCatalog: "asr:list-model-catalog",
  ListInstalledAsrModels: "asr:list-installed-models",
  DownloadAsrModel: "asr:download-model",
  ActivateAsrModel: "asr:activate-model",
  DeleteAsrModel: "asr:delete-model",
  GetRecognitionStrategy: "asr:get-recognition-strategy",
  UpdateRecognitionStrategy: "asr:update-recognition-strategy",
  ListProviders: "providers:list",
  CreateProvider: "providers:create",
  UpdateProvider: "providers:update",
  DeleteProvider: "providers:delete",
  TestProvider: "providers:test",
  ActivateProvider: "providers:activate"
} as const;

export type DesktopCommandName = (typeof DesktopCommand)[keyof typeof DesktopCommand];

export const DesktopEventChannel = {
  RuntimeEvent: "runtime:event"
} as const;

export type RuntimeSnapshot = {
  status: {
    listening: boolean;
  };
  metrics: Metrics;
  utterances: Utterance[];
};

export type DesktopApi = {
  session: {
    startListening(): Promise<void>;
    stopListening(): Promise<void>;
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

export type ModelIdPayload = {
  modelId: string;
};

export type ProviderIdPayload = {
  providerId: string;
};

export type UpdateProviderPayload = {
  providerId: string;
  patch: PatchProviderRequest;
};

export type DesktopCommandPayloadMap = {
  [DesktopCommand.StartListening]: void;
  [DesktopCommand.StopListening]: void;
  [DesktopCommand.GetRuntimeSnapshot]: void;
  [DesktopCommand.ListAsrModelCatalog]: void;
  [DesktopCommand.ListInstalledAsrModels]: void;
  [DesktopCommand.DownloadAsrModel]: ModelIdPayload;
  [DesktopCommand.ActivateAsrModel]: ModelIdPayload;
  [DesktopCommand.DeleteAsrModel]: ModelIdPayload;
  [DesktopCommand.GetRecognitionStrategy]: void;
  [DesktopCommand.UpdateRecognitionStrategy]: RecognitionStrategy;
  [DesktopCommand.ListProviders]: void;
  [DesktopCommand.CreateProvider]: CreateProviderRequest;
  [DesktopCommand.UpdateProvider]: UpdateProviderPayload;
  [DesktopCommand.DeleteProvider]: ProviderIdPayload;
  [DesktopCommand.TestProvider]: ProviderIdPayload;
  [DesktopCommand.ActivateProvider]: ProviderIdPayload;
};

export type DesktopCommandResponseMap = {
  [DesktopCommand.StartListening]: void;
  [DesktopCommand.StopListening]: void;
  [DesktopCommand.GetRuntimeSnapshot]: RuntimeSnapshot;
  [DesktopCommand.ListAsrModelCatalog]: AsrModelCatalogItem[];
  [DesktopCommand.ListInstalledAsrModels]: InstalledAsrModel[];
  [DesktopCommand.DownloadAsrModel]: void;
  [DesktopCommand.ActivateAsrModel]: void;
  [DesktopCommand.DeleteAsrModel]: void;
  [DesktopCommand.GetRecognitionStrategy]: RecognitionStrategy;
  [DesktopCommand.UpdateRecognitionStrategy]: RecognitionStrategy;
  [DesktopCommand.ListProviders]: ListProvidersResponse;
  [DesktopCommand.CreateProvider]: ProviderSummary;
  [DesktopCommand.UpdateProvider]: ProviderSummary;
  [DesktopCommand.DeleteProvider]: void;
  [DesktopCommand.TestProvider]: ProviderTestResult;
  [DesktopCommand.ActivateProvider]: void;
};

export type RuntimeEvent =
  | { type: "runtime:snapshot"; payload: RuntimeSnapshot }
  | { type: "session:status"; payload: { listening: boolean } }
  | { type: "runtime:metrics"; payload: Metrics }
  | { type: "runtime:utterance"; payload: Utterance }
  | { type: "emotion:started"; payload: { utteranceId: string } }
  | { type: "emotion:result"; payload: { utteranceId: string; result: EmotionResult } }
  | { type: "providers:list"; payload: { providers: ProviderSummary[] } }
  | { type: "asr:download-progress"; payload: DownloadProgressEvent }
  | { type: "asr:download-status"; payload: DownloadStatusEvent }
  | { type: "asr:recognition-strategy"; payload: RecognitionStrategy }
  | { type: "runtime:error"; payload: { code: DesktopErrorCode; message: string } };
