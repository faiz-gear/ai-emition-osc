export const ProviderErrorCodes = [
  "PROVIDER_NOT_FOUND",
  "PROVIDER_CONFLICT",
  "PROVIDER_VALIDATION_FAILED",
  "PROVIDER_TYPE_IMMUTABLE",
  "PROVIDER_ACTIVE_NOT_SET",
  "PROVIDER_SECRET_DECRYPT_FAILED",
  "PROVIDER_ROTATION_IN_PROGRESS",
  "PROVIDER_ACTIVATION_CONFLICT",
  "PROVIDER_AUTH_FAILED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_UPSTREAM_UNAVAILABLE"
] as const;

export type ProviderErrorCode = (typeof ProviderErrorCodes)[number];

export const AsrErrorCodes = [
  "ASR_MODEL_NOT_FOUND",
  "ASR_MODEL_NOT_INSTALLED",
  "ASR_DOWNLOAD_FAILED",
  "ASR_ACTIVATION_FAILED",
  "ASR_RECOGNITION_FAILED",
  "ASR_INVALID_LANGUAGE",
  "ASR_INVALID_RECOGNITION_STRATEGY"
] as const;

export type AsrErrorCode = (typeof AsrErrorCodes)[number];

export type DesktopErrorCode = ProviderErrorCode | AsrErrorCode;

export const isProviderErrorCode = (value: string): value is ProviderErrorCode =>
  (ProviderErrorCodes as readonly string[]).includes(value);

export const isAsrErrorCode = (value: string): value is AsrErrorCode =>
  (AsrErrorCodes as readonly string[]).includes(value);

export const isDesktopErrorCode = (value: string): value is DesktopErrorCode =>
  isProviderErrorCode(value) || isAsrErrorCode(value);
