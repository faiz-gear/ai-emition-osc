"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  DEFAULT_RUNTIME_CONFIG,
  RUNTIME_WARNING_DISMISSED_STORAGE_KEY,
  loadRuntimeConfig,
  resetRuntimeConfigToDefault,
  saveRuntimeConfig,
  type RuntimeConfig,
  type RuntimeConfigValidationError,
  type RuntimeWarningCode,
} from "@/lib/config";
import { useI18n } from "@/lib/i18n";

import { SettingsEndpointSection } from "./SettingsEndpointSection";
import { SettingsLanguageSection } from "./SettingsLanguageSection";
import { SettingsProviderSection } from "./SettingsProviderSection";

type MutationState = "idle" | "saving" | "resetting";

function isRuntimeWarningCode(value: unknown): value is RuntimeWarningCode {
  return (
    value === "invalid_json" ||
    value === "invalid_shape" ||
    value === "version_mismatch" ||
    value === "invalid_env_default" ||
    value === "storage_unavailable"
  );
}

function hydrateDismissedWarningCodes(): RuntimeWarningCode[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(RUNTIME_WARNING_DISMISSED_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isRuntimeWarningCode);
  } catch {
    return [];
  }
}

function persistDismissedWarningCodes(codes: RuntimeWarningCode[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      RUNTIME_WARNING_DISMISSED_STORAGE_KEY,
      JSON.stringify(codes),
    );
  } catch {
    // Fallback to in-memory dedupe only.
  }
}

export function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>(DEFAULT_RUNTIME_CONFIG);
  const [warningCode, setWarningCode] = useState<RuntimeWarningCode | null>(null);
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [apiBaseRevision, setApiBaseRevision] = useState(0);
  const [validationErrors, setValidationErrors] = useState<RuntimeConfigValidationError[]>(
    [],
  );
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [dismissedWarningCodes, setDismissedWarningCodes] = useState<
    RuntimeWarningCode[]
  >([]);

  const mutationTokenRef = useRef(0);

  useEffect(() => {
    const loadResult = loadRuntimeConfig();
    setRuntimeConfig(loadResult.config);
    setWarningCode(loadResult.warningCode);
  }, []);

  useEffect(() => {
    setDismissedWarningCodes(hydrateDismissedWarningCodes());
  }, []);

  useEffect(() => {
    persistDismissedWarningCodes(dismissedWarningCodes);
  }, [dismissedWarningCodes]);

  const isEndpointMutating = mutationState !== "idle";

  const beginMutation = useCallback((nextState: MutationState) => {
    if (nextState === "idle") {
      return null;
    }

    if (mutationTokenRef.current !== 0 && mutationState !== "idle") {
      return null;
    }

    const token = mutationTokenRef.current + 1;
    mutationTokenRef.current = token;
    setMutationState(nextState);
    setValidationErrors([]);
    setActionErrorMessage(null);
    return token;
  }, [mutationState]);

  const completeMutation = useCallback((token: number) => {
    if (mutationTokenRef.current !== token) {
      return false;
    }
    setMutationState("idle");
    return true;
  }, []);

  const handleSave = useCallback(
    async (nextConfig: RuntimeConfig) => {
      const token = beginMutation("saving");
      if (!token) {
        return;
      }

      await Promise.resolve();
      const result = saveRuntimeConfig(nextConfig);
      if (!completeMutation(token)) {
        return;
      }

      if (!result.ok) {
        setValidationErrors(result.validationErrors);
        setWarningCode(result.warningCode);
        setActionErrorMessage(result.errorMessage ?? t("settingsMutationFailed"));
        return;
      }

      setRuntimeConfig((current) => {
        if (current.apiBase !== result.config.apiBase) {
          setApiBaseRevision((revision) => revision + 1);
        }
        return result.config;
      });
      setWarningCode(result.warningCode);
      setActionErrorMessage(
        result.persisted ? null : result.errorMessage ?? t("settingsStorageWriteFailed"),
      );
    },
    [beginMutation, completeMutation, t],
  );

  const handleReset = useCallback(async () => {
    const token = beginMutation("resetting");
    if (!token) {
      return;
    }

    await Promise.resolve();
    const result = resetRuntimeConfigToDefault();
    if (!completeMutation(token)) {
      return;
    }

    if (!result.ok) {
      setValidationErrors(result.validationErrors);
      setWarningCode(result.warningCode);
      setActionErrorMessage(result.errorMessage ?? t("settingsMutationFailed"));
      return;
    }

    setRuntimeConfig((current) => {
      if (current.apiBase !== result.config.apiBase) {
        setApiBaseRevision((revision) => revision + 1);
      }
      return result.config;
    });
    setWarningCode(result.warningCode);
    setActionErrorMessage(
      result.persisted ? null : result.errorMessage ?? t("settingsStorageWriteFailed"),
    );
  }, [beginMutation, completeMutation, t]);

  const handleDismissWarning = useCallback((code: RuntimeWarningCode) => {
    setDismissedWarningCodes((current) => {
      if (current.includes(code)) {
        return current;
      }
      return [...current, code];
    });
  }, []);

  return (
    <section className="grid gap-5">
      <header className="rounded-[1.75rem] border border-[color:var(--border)] bg-white/85 p-5">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">
          {t("settingsTitle")}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          {t("settingsDescription")}
        </p>
      </header>

      <SettingsLanguageSection locale={locale} onChangeLocale={setLocale} />

      <SettingsEndpointSection
        value={runtimeConfig}
        warningCode={warningCode}
        dismissedWarningCodes={dismissedWarningCodes}
        validationErrors={validationErrors}
        isSaving={isEndpointMutating}
        actionErrorMessage={actionErrorMessage}
        onSave={handleSave}
        onReset={handleReset}
        onDismissWarning={handleDismissWarning}
      />

      <SettingsProviderSection
        apiBase={runtimeConfig.apiBase}
        apiBaseRevision={apiBaseRevision}
        isEndpointMutating={isEndpointMutating}
      />
    </section>
  );
}
