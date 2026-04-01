import * as electron from "electron";
import {
  DesktopCommand,
  type DesktopCommandName,
  type DesktopCommandPayloadMap,
  type DesktopCommandResponseMap
} from "@ai-emotion/contracts";
import type { DesktopIpcServices } from "./desktop-ipc-services";
import { getDefaultDesktopIpcServices } from "./in-memory-desktop-ipc-services";
import { invokeValidators } from "./validators";

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

export function registerIpc(services: DesktopIpcServices = getDefaultDesktopIpcServices()): void {
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
