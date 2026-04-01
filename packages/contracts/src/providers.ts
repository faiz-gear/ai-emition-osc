import type { ProviderSummary, ProviderType } from "./domain";

export type ProviderTestResult = {
  ok: boolean;
  latency_ms: number;
};

export type ProviderErrorResponse = {
  code: string;
  message: string;
  details: Record<string, unknown>;
};

export type CreateProviderRequest = {
  name: string;
  provider_type: ProviderType;
  provider_key?: string | null;
  model: string;
  base_url?: string | null;
  temperature?: number | null;
  api_key?: string | null;
  headers?: Record<string, string> | null;
};

export type PatchProviderRequest = Partial<CreateProviderRequest>;

export type ListProvidersResponse = {
  providers: ProviderSummary[];
};
