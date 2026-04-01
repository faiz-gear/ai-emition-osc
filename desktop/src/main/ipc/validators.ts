import {
  DesktopCommand,
  type CreateProviderRequest,
  type DesktopCommandName,
  type DesktopCommandPayloadMap,
  type ModelIdPayload,
  type PatchProviderRequest,
  type ProviderIdPayload,
  type UpdateProviderPayload,
  isRecognitionStrategy
} from "@ai-emotion/contracts";

type PayloadValidator<K extends DesktopCommandName> = (
  value: unknown
) => DesktopCommandPayloadMap[K];

function invalidPayload(message: string): Error {
  return new Error(`Invalid IPC payload: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || typeof value === "number";
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function requireNoPayload(value: unknown): void {
  if (value !== undefined) {
    throw invalidPayload("expected no payload");
  }
}

function requireModelIdPayload(value: unknown): ModelIdPayload {
  if (!isRecord(value) || typeof value.modelId !== "string" || value.modelId.trim().length === 0) {
    throw invalidPayload("expected { modelId: string }");
  }

  return { modelId: value.modelId };
}

function requireProviderIdPayload(value: unknown): ProviderIdPayload {
  if (
    !isRecord(value) ||
    typeof value.providerId !== "string" ||
    value.providerId.trim().length === 0
  ) {
    throw invalidPayload("expected { providerId: string }");
  }

  return { providerId: value.providerId };
}

function validateCreateProvider(value: unknown): CreateProviderRequest {
  if (!isRecord(value)) {
    throw invalidPayload("expected provider object");
  }

  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw invalidPayload("provider name is required");
  }

  if (
    value.provider_type !== "ollama" &&
    value.provider_type !== "openai" &&
    value.provider_type !== "openai_compatible"
  ) {
    throw invalidPayload("provider_type is invalid");
  }

  if (typeof value.model !== "string" || value.model.trim().length === 0) {
    throw invalidPayload("provider model is required");
  }

  if (!isOptionalString(value.provider_key)) {
    throw invalidPayload("provider_key must be a string, null, or undefined");
  }

  if (!isOptionalString(value.base_url)) {
    throw invalidPayload("base_url must be a string, null, or undefined");
  }

  if (!isOptionalNumber(value.temperature)) {
    throw invalidPayload("temperature must be a number, null, or undefined");
  }

  if (!isOptionalString(value.api_key)) {
    throw invalidPayload("api_key must be a string, null, or undefined");
  }

  if (
    value.headers !== undefined &&
    value.headers !== null &&
    !isStringRecord(value.headers)
  ) {
    throw invalidPayload("headers must be a string map, null, or undefined");
  }

  const provider: CreateProviderRequest = {
    name: value.name,
    provider_type: value.provider_type,
    model: value.model
  };

  if (value.provider_key !== undefined) {
    provider.provider_key = value.provider_key as string | null;
  }

  if (value.base_url !== undefined) {
    provider.base_url = value.base_url as string | null;
  }

  if (value.temperature !== undefined) {
    provider.temperature = value.temperature as number | null;
  }

  if (value.api_key !== undefined) {
    provider.api_key = value.api_key as string | null;
  }

  if (value.headers !== undefined) {
    provider.headers = value.headers as Record<string, string> | null;
  }

  return provider;
}

function validatePatchProvider(value: unknown): PatchProviderRequest {
  if (!isRecord(value)) {
    throw invalidPayload("expected provider patch object");
  }

  const allowedKeys = new Set([
    "name",
    "provider_type",
    "provider_key",
    "model",
    "base_url",
    "temperature",
    "api_key",
    "headers"
  ]);

  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw invalidPayload(`unexpected provider patch field: ${key}`);
    }
  }

  if (value.name !== undefined && (typeof value.name !== "string" || value.name.trim().length === 0)) {
    throw invalidPayload("provider patch name must be a non-empty string");
  }

  if (
    value.provider_type !== undefined &&
    value.provider_type !== "ollama" &&
    value.provider_type !== "openai" &&
    value.provider_type !== "openai_compatible"
  ) {
    throw invalidPayload("provider patch provider_type is invalid");
  }

  if (
    value.model !== undefined &&
    (typeof value.model !== "string" || value.model.trim().length === 0)
  ) {
    throw invalidPayload("provider patch model must be a non-empty string");
  }

  if (!isOptionalString(value.provider_key)) {
    throw invalidPayload("provider patch provider_key must be a string, null, or undefined");
  }

  if (!isOptionalString(value.base_url)) {
    throw invalidPayload("provider patch base_url must be a string, null, or undefined");
  }

  if (!isOptionalNumber(value.temperature)) {
    throw invalidPayload("provider patch temperature must be a number, null, or undefined");
  }

  if (!isOptionalString(value.api_key)) {
    throw invalidPayload("provider patch api_key must be a string, null, or undefined");
  }

  if (
    value.headers !== undefined &&
    value.headers !== null &&
    !isStringRecord(value.headers)
  ) {
    throw invalidPayload("provider patch headers must be a string map, null, or undefined");
  }

  const patch: PatchProviderRequest = {};

  if (value.name !== undefined) {
    patch.name = value.name;
  }

  if (value.provider_type !== undefined) {
    patch.provider_type = value.provider_type;
  }

  if (value.provider_key !== undefined) {
    patch.provider_key = value.provider_key as string | null;
  }

  if (value.model !== undefined) {
    patch.model = value.model;
  }

  if (value.base_url !== undefined) {
    patch.base_url = value.base_url as string | null;
  }

  if (value.temperature !== undefined) {
    patch.temperature = value.temperature as number | null;
  }

  if (value.api_key !== undefined) {
    patch.api_key = value.api_key as string | null;
  }

  if (value.headers !== undefined) {
    patch.headers = value.headers as Record<string, string> | null;
  }

  return patch;
}

function requireUpdateProviderPayload(value: unknown): UpdateProviderPayload {
  if (!isRecord(value)) {
    throw invalidPayload("expected { providerId, patch }");
  }

  if (typeof value.providerId !== "string" || value.providerId.trim().length === 0) {
    throw invalidPayload("providerId is required");
  }

  return {
    providerId: value.providerId,
    patch: validatePatchProvider(value.patch)
  };
}

export const invokeValidators: {
  [K in DesktopCommandName]: PayloadValidator<K>;
} = {
  [DesktopCommand.StartListening]: requireNoPayload,
  [DesktopCommand.StopListening]: requireNoPayload,
  [DesktopCommand.GetRuntimeSnapshot]: requireNoPayload,
  [DesktopCommand.ListAsrModelCatalog]: requireNoPayload,
  [DesktopCommand.ListInstalledAsrModels]: requireNoPayload,
  [DesktopCommand.DownloadAsrModel]: requireModelIdPayload,
  [DesktopCommand.ActivateAsrModel]: requireModelIdPayload,
  [DesktopCommand.DeleteAsrModel]: requireModelIdPayload,
  [DesktopCommand.GetRecognitionStrategy]: requireNoPayload,
  [DesktopCommand.UpdateRecognitionStrategy](value) {
    if (!isRecognitionStrategy(value)) {
      throw invalidPayload("recognition strategy is invalid");
    }

    return value;
  },
  [DesktopCommand.ListProviders]: requireNoPayload,
  [DesktopCommand.CreateProvider]: validateCreateProvider,
  [DesktopCommand.UpdateProvider]: requireUpdateProviderPayload,
  [DesktopCommand.DeleteProvider]: requireProviderIdPayload,
  [DesktopCommand.TestProvider]: requireProviderIdPayload,
  [DesktopCommand.ActivateProvider]: requireProviderIdPayload
};
