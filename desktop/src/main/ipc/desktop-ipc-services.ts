import type {
  AsrModelCatalogItem,
  CreateProviderRequest,
  InstalledAsrModel,
  ListProvidersResponse,
  PatchProviderRequest,
  ProviderSummary,
  ProviderTestResult,
  RecognitionStrategy,
  RuntimeEvent,
  RuntimeSnapshot
} from "@ai-emotion/contracts";
import type { CapturePcmFramePayload } from "../../runtime/asr/capture-ipc";

export type DesktopIpcServices = {
  session: {
    startListening(): Promise<void>;
    stopListening(): Promise<void>;
    handleCapturePcmFrame(frame: CapturePcmFramePayload): Promise<void>;
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
