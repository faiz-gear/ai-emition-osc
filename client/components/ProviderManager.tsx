"use client";

import React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/lib/i18n";
import type {
  CreateProviderRequest,
  PatchProviderRequest,
  ProviderSummary,
  ProviderTestResult,
  ProviderType
} from "@/lib/types";

type Props = {
  activeProviderId: string | null;
  apiBase?: string;
  transport?: ProviderManagerTransport;
};

export type ProviderManagerTransport = {
  listProviders: () => Promise<ProviderSummary[]>;
  createProvider: (input: CreateProviderRequest) => Promise<ProviderSummary>;
  updateProvider: (providerId: string, patch: PatchProviderRequest) => Promise<ProviderSummary>;
  deleteProvider: (providerId: string) => Promise<void>;
  testProvider: (providerId: string) => Promise<ProviderTestResult>;
  activateProvider: (providerId: string) => Promise<void>;
};

const PROVIDER_TYPES: ProviderType[] = ["ollama", "openai", "openai_compatible"];

function parseErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "detail" in payload &&
    payload.detail &&
    typeof payload.detail === "object" &&
    "message" in payload.detail &&
    typeof payload.detail.message === "string"
  ) {
    return payload.detail.message;
  }
  return fallback;
}

function createHttpTransport(apiBase: string): ProviderManagerTransport {
  return {
    async listProviders() {
      const response = await fetch(`${apiBase}/api/providers`);
      if (!response.ok) {
        throw new Error(`Failed to load providers (${response.status})`);
      }
      return (await response.json()) as ProviderSummary[];
    },
    async createProvider(input) {
      const response = await fetch(`${apiBase}/api/providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(parseErrorMessage(body, `Create failed (${response.status})`));
      }
      return (await response.json()) as ProviderSummary;
    },
    async updateProvider(providerId, patch) {
      const response = await fetch(`${apiBase}/api/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(parseErrorMessage(body, `Update failed (${response.status})`));
      }
      return (await response.json()) as ProviderSummary;
    },
    async deleteProvider(providerId) {
      const response = await fetch(`${apiBase}/api/providers/${providerId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(parseErrorMessage(body, `Delete failed (${response.status})`));
      }
    },
    async testProvider(providerId) {
      const response = await fetch(`${apiBase}/api/providers/${providerId}/test`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(parseErrorMessage(body, `Test failed (${response.status})`));
      }
      return (await response.json()) as ProviderTestResult;
    },
    async activateProvider(providerId) {
      const response = await fetch(`${apiBase}/api/providers/${providerId}/activate`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(parseErrorMessage(body, `Activate failed (${response.status})`));
      }
    },
  };
}

export function ProviderManager({ apiBase, activeProviderId, transport }: Props) {
  const { t } = useI18n();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("ollama");
  const [providerKey, setProviderKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [temperature, setTemperature] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [headersText, setHeadersText] = useState("");

  const isEditing = editingId !== null;
  const providerTransport = useMemo(() => {
    if (transport) {
      return transport;
    }
    if (!apiBase) {
      return null;
    }
    return createHttpTransport(apiBase);
  }, [apiBase, transport]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName("");
    setProviderType("ollama");
    setProviderKey("");
    setModel("");
    setBaseUrl("");
    setTemperature("");
    setApiKey("");
    setHeadersText("");
  }, []);

  const loadProviders = useCallback(async () => {
    if (!providerTransport) {
      setProviders([]);
      return;
    }
    const data = await providerTransport.listProviders();
    setProviders(data);
  }, [providerTransport]);

  useEffect(() => {
    void loadProviders().catch((err) => setError(String(err)));
  }, [loadProviders]);

  const activeIdFromList = useMemo(() => {
    return providers.find((item) => item.is_active)?.id ?? null;
  }, [providers]);
  const effectiveActiveId = activeIdFromList ?? activeProviderId;

  const submit = useCallback(async () => {
    setError(null);
    setInfo(null);
    try {
      let headers: Record<string, string> | null | undefined = undefined;
      if (headersText.trim() !== "") {
        headers = JSON.parse(headersText) as Record<string, string>;
      } else if (!isEditing) {
        headers = null;
      }

      const parsedTemp =
        temperature.trim() === "" ? undefined : Number.parseFloat(temperature);

      if (isEditing && editingId) {
        const payload: PatchProviderRequest = {
          name: name || undefined,
          model: model || undefined,
          provider_key:
            providerType === "openai_compatible"
              ? providerKey || undefined
              : undefined,
          base_url: baseUrl || undefined,
          temperature: Number.isNaN(parsedTemp ?? Number.NaN)
            ? undefined
            : parsedTemp,
          api_key: apiKey || undefined,
          headers
        };
        if (!providerTransport) {
          throw new Error("provider transport unavailable");
        }
        await providerTransport.updateProvider(editingId, payload);
        setInfo(t("providerUpdated"));
      } else {
        const payload: CreateProviderRequest = {
          name,
          provider_type: providerType,
          provider_key: providerType === "openai_compatible" ? providerKey || null : null,
          model,
          base_url: baseUrl || null,
          temperature: Number.isNaN(parsedTemp ?? Number.NaN) ? null : parsedTemp ?? null,
          api_key: apiKey || null,
          headers: headers ?? null
        };
        if (!providerTransport) {
          throw new Error("provider transport unavailable");
        }
        await providerTransport.createProvider(payload);
        setInfo(t("providerCreated"));
      }
      await loadProviders();
      resetForm();
    } catch (err) {
      setError(String(err));
    }
  }, [
    apiKey,
    baseUrl,
    editingId,
    headersText,
    isEditing,
    loadProviders,
    model,
    name,
    providerKey,
    providerTransport,
    providerType,
    resetForm,
    t,
    temperature
  ]);

  const activateProvider = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        if (!providerTransport) {
          throw new Error("provider transport unavailable");
        }
        await providerTransport.activateProvider(id);
        await loadProviders();
      } catch (err) {
        setError(String(err));
      } finally {
        setBusyId(null);
      }
    },
    [loadProviders, providerTransport]
  );

  const testProvider = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        if (!providerTransport) {
          throw new Error("provider transport unavailable");
        }
        const result = await providerTransport.testProvider(id);
        setInfo(t("providerTestOk", { latency: Math.round(result.latency_ms) }));
      } catch (err) {
        setError(String(err));
      } finally {
        setBusyId(null);
      }
    },
    [providerTransport, t]
  );

  const deleteProvider = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        if (!providerTransport) {
          throw new Error("provider transport unavailable");
        }
        await providerTransport.deleteProvider(id);
        await loadProviders();
      } catch (err) {
        setError(String(err));
      } finally {
        setBusyId(null);
      }
    },
    [loadProviders, providerTransport]
  );

  const startEdit = useCallback((provider: ProviderSummary) => {
    setEditingId(provider.id);
    setName(provider.name);
    setProviderType(provider.provider_type);
    setProviderKey(provider.provider_key ?? "");
    setModel(provider.model);
    setBaseUrl(provider.base_url ?? "");
    setTemperature(
      provider.temperature === null || provider.temperature === undefined
        ? ""
        : String(provider.temperature)
    );
    setApiKey("");
    setHeadersText("");
    setError(null);
    setInfo(null);
  }, []);

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">{t("providerManager")}</p>
          <p className="text-xs text-[color:var(--text-secondary)]">
            {t("providerManagerDescription")}
          </p>
        </div>
        <button
          onClick={() => void loadProviders()}
          className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--text-secondary)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[color:var(--surface-muted)] active:-translate-y-[1px]"
        >
          {t("refresh")}
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-[color:var(--danger)]">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-[color:var(--success)]">
          {info}
        </div>
      ) : null}

      <div className="space-y-2">
        {providers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-white p-3 text-xs text-[color:var(--text-secondary)]">
            {t("noProvidersConfigured")}
          </div>
        ) : null}

        {providers.map((provider) => (
          <div
            key={provider.id}
            className="rounded-2xl border border-[color:var(--border)] bg-white p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {provider.name}{" "}
                  <span className="text-xs font-normal text-[color:var(--text-secondary)]">
                    ({provider.provider_type})
                  </span>
                </div>
                <div className="text-xs text-[color:var(--text-secondary)]">
                  {t("modelLabel")}: {provider.model}
                  {provider.base_url ? ` · ${t("baseLabel")}: ${provider.base_url}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {provider.id === effectiveActiveId ? (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-[color:var(--success)]">
                    {t("active")}
                  </span>
                ) : null}
                <button
                  onClick={() => void activateProvider(provider.id)}
                  disabled={busyId === provider.id || provider.id === effectiveActiveId}
                  className="rounded-xl border border-[color:rgba(15,118,110,0.35)] bg-[color:var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--accent)] disabled:opacity-50"
                >
                  {t("activate")}
                </button>
                <button
                  onClick={() => void testProvider(provider.id)}
                  disabled={busyId === provider.id}
                  className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--warning)] disabled:opacity-50"
                >
                  {t("test")}
                </button>
                <button
                  onClick={() => startEdit(provider)}
                  className="rounded-xl border border-zinc-500/30 bg-zinc-500/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--text-secondary)]"
                >
                  {t("edit")}
                </button>
                <button
                  onClick={() => void deleteProvider(provider.id)}
                  disabled={busyId === provider.id}
                  className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--danger)] disabled:opacity-50"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="provider-name" className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {t("name")}
          </label>
          <input
            id="provider-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          <p className="text-[11px] text-[color:var(--text-secondary)]">{t("humanLabelHint")}</p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="provider-type" className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {t("providerType")}
          </label>
          <select
            id="provider-type"
            value={providerType}
            onChange={(e) => setProviderType(e.target.value as ProviderType)}
            disabled={isEditing}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)] disabled:opacity-60"
          >
            {PROVIDER_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-[color:var(--text-secondary)]">
            {t("providerTypeLockHint")}
          </p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="provider-model" className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {t("model")}
          </label>
          <input
            id="provider-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          <p className="text-[11px] text-[color:var(--text-secondary)]">{t("modelHint")}</p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="provider-base-url" className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {t("baseUrl")}
          </label>
          <input
            id="provider-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          <p className="text-[11px] text-[color:var(--text-secondary)]">{t("baseUrlHint")}</p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="provider-key" className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {t("providerKey")}
          </label>
          <input
            id="provider-key"
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          <p className="text-[11px] text-[color:var(--text-secondary)]">
            {t("providerKeyHint")}
          </p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="provider-temperature" className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {t("temperature")}
          </label>
          <input
            id="provider-temperature"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          <p className="text-[11px] text-[color:var(--text-secondary)]">{t("temperatureHint")}</p>
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label htmlFor="provider-api-key" className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {t("apiKey")}
          </label>
          <input
            id="provider-api-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          <p className="text-[11px] text-[color:var(--text-secondary)]">
            {isEditing ? t("apiKeyHintEdit") : t("apiKeyHintCreate")}
          </p>
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label htmlFor="provider-headers" className="text-xs font-semibold text-[color:var(--text-secondary)]">
            {t("headersJson")}
          </label>
          <textarea
            id="provider-headers"
            value={headersText}
            onChange={(e) => setHeadersText(e.target.value)}
            className="min-h-20 rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          <p className="text-[11px] text-[color:var(--text-secondary)]">
            {t("headersExample")} <code>{`{"x-app":"ai-emotion"}`}</code>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => void submit()}
          className="rounded-xl border border-[color:rgba(15,118,110,0.35)] bg-[color:var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--accent)]"
        >
          {isEditing ? t("updateProvider") : t("createProvider")}
        </button>
        {isEditing ? (
          <button
            onClick={resetForm}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-secondary)]"
          >
            {t("cancelEdit")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
