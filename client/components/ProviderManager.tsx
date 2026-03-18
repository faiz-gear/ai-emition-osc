"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CreateProviderRequest,
  PatchProviderRequest,
  ProviderSummary,
  ProviderTestResult,
  ProviderType
} from "@/lib/types";

type Props = {
  apiBase: string;
  activeProviderId: string | null;
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

export function ProviderManager({ apiBase, activeProviderId }: Props) {
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
    const response = await fetch(`${apiBase}/api/providers`);
    if (!response.ok) {
      throw new Error(`Failed to load providers (${response.status})`);
    }
    const data = (await response.json()) as ProviderSummary[];
    setProviders(data);
  }, [apiBase]);

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
        const response = await fetch(`${apiBase}/api/providers/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(parseErrorMessage(body, `Update failed (${response.status})`));
        }
        setInfo("Provider updated");
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
        const response = await fetch(`${apiBase}/api/providers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(parseErrorMessage(body, `Create failed (${response.status})`));
        }
        setInfo("Provider created");
      }
      await loadProviders();
      resetForm();
    } catch (err) {
      setError(String(err));
    }
  }, [
    apiBase,
    apiKey,
    baseUrl,
    editingId,
    headersText,
    isEditing,
    loadProviders,
    model,
    name,
    providerKey,
    providerType,
    resetForm,
    temperature
  ]);

  const activateProvider = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const response = await fetch(`${apiBase}/api/providers/${id}/activate`, {
          method: "POST"
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(parseErrorMessage(body, `Activate failed (${response.status})`));
        }
        await loadProviders();
      } catch (err) {
        setError(String(err));
      } finally {
        setBusyId(null);
      }
    },
    [apiBase, loadProviders]
  );

  const testProvider = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const response = await fetch(`${apiBase}/api/providers/${id}/test`, {
          method: "POST"
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(parseErrorMessage(body, `Test failed (${response.status})`));
        }
        const result = (await response.json()) as ProviderTestResult;
        setInfo(`Provider test OK (${Math.round(result.latency_ms)}ms)`);
      } catch (err) {
        setError(String(err));
      } finally {
        setBusyId(null);
      }
    },
    [apiBase]
  );

  const deleteProvider = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const response = await fetch(`${apiBase}/api/providers/${id}`, {
          method: "DELETE"
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(parseErrorMessage(body, `Delete failed (${response.status})`));
        }
        await loadProviders();
      } catch (err) {
        setError(String(err));
      } finally {
        setBusyId(null);
      }
    },
    [apiBase, loadProviders]
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
    <section className="rounded-xl bg-slate-900/60 p-4 ring-1 ring-slate-800">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-100">Provider Manager</div>
        <button
          onClick={() => void loadProviders()}
          className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-200 ring-1 ring-rose-500/20">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="mb-3 rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-200 ring-1 ring-emerald-500/20">
          {info}
        </div>
      ) : null}

      <div className="space-y-2">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="rounded-lg bg-slate-950/50 p-3 ring-1 ring-slate-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm text-slate-100">
                  {provider.name}{" "}
                  <span className="text-xs text-slate-400">({provider.provider_type})</span>
                </div>
                <div className="text-xs text-slate-400">
                  model: {provider.model}{" "}
                  {provider.base_url ? `· base: ${provider.base_url}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {provider.id === effectiveActiveId ? (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/30">
                    Active
                  </span>
                ) : null}
                <button
                  onClick={() => void activateProvider(provider.id)}
                  disabled={busyId === provider.id || provider.id === effectiveActiveId}
                  className="rounded-md bg-sky-500/20 px-2 py-1 text-xs text-sky-200 ring-1 ring-sky-500/30 disabled:opacity-50"
                >
                  Activate
                </button>
                <button
                  onClick={() => void testProvider(provider.id)}
                  disabled={busyId === provider.id}
                  className="rounded-md bg-indigo-500/20 px-2 py-1 text-xs text-indigo-200 ring-1 ring-indigo-500/30 disabled:opacity-50"
                >
                  Test
                </button>
                <button
                  onClick={() => startEdit(provider)}
                  className="rounded-md bg-amber-500/20 px-2 py-1 text-xs text-amber-200 ring-1 ring-amber-500/30"
                >
                  Edit
                </button>
                <button
                  onClick={() => void deleteProvider(provider.id)}
                  disabled={busyId === provider.id}
                  className="rounded-md bg-rose-500/20 px-2 py-1 text-xs text-rose-200 ring-1 ring-rose-500/30 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="rounded-md bg-slate-950/50 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
        />
        <select
          value={providerType}
          onChange={(e) => setProviderType(e.target.value as ProviderType)}
          disabled={isEditing}
          className="rounded-md bg-slate-950/50 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700 disabled:opacity-60"
        >
          {PROVIDER_TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model"
          className="rounded-md bg-slate-950/50 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
        />
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="Base URL (optional)"
          className="rounded-md bg-slate-950/50 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
        />
        <input
          value={providerKey}
          onChange={(e) => setProviderKey(e.target.value)}
          placeholder="Provider Key (openai_compatible)"
          className="rounded-md bg-slate-950/50 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
        />
        <input
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          placeholder="Temperature (0-2)"
          className="rounded-md bg-slate-950/50 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700"
        />
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={isEditing ? "API Key (leave blank to keep)" : "API Key"}
          className="rounded-md bg-slate-950/50 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700 md:col-span-2"
        />
        <textarea
          value={headersText}
          onChange={(e) => setHeadersText(e.target.value)}
          placeholder='Headers JSON (optional), e.g. {"x-app":"ai-emotion"}'
          className="min-h-20 rounded-md bg-slate-950/50 px-2 py-2 text-sm text-slate-100 ring-1 ring-slate-700 md:col-span-2"
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void submit()}
          className="rounded-md bg-emerald-500/20 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30"
        >
          {isEditing ? "Update Provider" : "Create Provider"}
        </button>
        {isEditing ? (
          <button
            onClick={resetForm}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-700"
          >
            Cancel Edit
          </button>
        ) : null}
      </div>
    </section>
  );
}
