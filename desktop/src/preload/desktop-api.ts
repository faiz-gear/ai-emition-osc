import { ipcRenderer } from "electron";
import {
  DesktopCommand,
  DesktopEventChannel,
  type AsrModelCatalogItem,
  type CreateProviderRequest,
  type DesktopApi,
  type InstalledAsrModel,
  type ListProvidersResponse,
  type PatchProviderRequest,
  type ProviderSummary,
  type ProviderTestResult,
  type RecognitionStrategy,
  type RuntimeEvent,
  type RuntimeSnapshot
} from "@ai-emotion/contracts";

type IpcRendererLike = Pick<typeof ipcRenderer, "invoke" | "on" | "off">;
export type { DesktopApi } from "@ai-emotion/contracts";

function invoke<TResponse>(ipc: IpcRendererLike, commandName: string, payload?: unknown): Promise<TResponse> {
  return ipc.invoke(commandName, payload) as Promise<TResponse>;
}

export function createDesktopApi(ipc: IpcRendererLike = ipcRenderer): DesktopApi {
  return {
    session: {
      startListening() {
        return invoke<void>(ipc, DesktopCommand.StartListening);
      },
      stopListening() {
        return invoke<void>(ipc, DesktopCommand.StopListening);
      },
      getSnapshot() {
        return invoke<RuntimeSnapshot>(ipc, DesktopCommand.GetRuntimeSnapshot);
      },
      subscribe(listener) {
        const wrappedListener = (_event: unknown, runtimeEvent: RuntimeEvent) => {
          listener(runtimeEvent);
        };

        ipc.on(DesktopEventChannel.RuntimeEvent, wrappedListener);
        return () => {
          ipc.off(DesktopEventChannel.RuntimeEvent, wrappedListener);
        };
      }
    },
    asr: {
      listCatalog() {
        return invoke<AsrModelCatalogItem[]>(ipc, DesktopCommand.ListAsrModelCatalog);
      },
      listInstalled() {
        return invoke<InstalledAsrModel[]>(ipc, DesktopCommand.ListInstalledAsrModels);
      },
      downloadModel(modelId) {
        return invoke<void>(ipc, DesktopCommand.DownloadAsrModel, { modelId });
      },
      activateModel(modelId) {
        return invoke<void>(ipc, DesktopCommand.ActivateAsrModel, { modelId });
      },
      deleteModel(modelId) {
        return invoke<void>(ipc, DesktopCommand.DeleteAsrModel, { modelId });
      },
      getRecognitionStrategy() {
        return invoke<RecognitionStrategy>(ipc, DesktopCommand.GetRecognitionStrategy);
      },
      updateRecognitionStrategy(input) {
        return invoke<RecognitionStrategy>(ipc, DesktopCommand.UpdateRecognitionStrategy, input);
      }
    },
    providers: {
      list() {
        return invoke<ListProvidersResponse>(ipc, DesktopCommand.ListProviders);
      },
      create(input) {
        return invoke<ProviderSummary>(ipc, DesktopCommand.CreateProvider, input);
      },
      update(providerId, patch) {
        return invoke<ProviderSummary>(ipc, DesktopCommand.UpdateProvider, {
          providerId,
          patch
        });
      },
      delete(providerId) {
        return invoke<void>(ipc, DesktopCommand.DeleteProvider, { providerId });
      },
      test(providerId) {
        return invoke<ProviderTestResult>(ipc, DesktopCommand.TestProvider, { providerId });
      },
      activate(providerId) {
        return invoke<void>(ipc, DesktopCommand.ActivateProvider, { providerId });
      }
    }
  };
}
