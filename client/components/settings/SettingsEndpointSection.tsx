"use client";

import React, { useEffect, useMemo, useState } from "react";

import type {
  RuntimeConfig,
  RuntimeConfigValidationError,
  RuntimeWarningCode,
} from "@/lib/config";
import { useI18n } from "@/lib/i18n";

type SettingsEndpointSectionProps = {
  value: RuntimeConfig;
  warningCode: RuntimeWarningCode | null;
  dismissedWarningCodes: RuntimeWarningCode[];
  validationErrors: RuntimeConfigValidationError[];
  isSaving: boolean;
  actionErrorMessage: string | null;
  onSave: (nextValue: RuntimeConfig) => void;
  onReset: () => void;
  onDismissWarning: (warningCode: RuntimeWarningCode) => void;
};

function warningMessageKey(code: RuntimeWarningCode) {
  switch (code) {
    case "invalid_json":
      return "settingsWarningInvalidJson";
    case "invalid_shape":
      return "settingsWarningInvalidShape";
    case "version_mismatch":
      return "settingsWarningVersionMismatch";
    case "invalid_env_default":
      return "settingsWarningInvalidEnvDefault";
    case "storage_unavailable":
      return "settingsWarningStorageUnavailable";
    default:
      return null;
  }
}

export function SettingsEndpointSection({
  value,
  warningCode,
  dismissedWarningCodes,
  validationErrors,
  isSaving,
  actionErrorMessage,
  onSave,
  onReset,
  onDismissWarning,
}: SettingsEndpointSectionProps) {
  const { t } = useI18n();
  const [formValue, setFormValue] = useState<RuntimeConfig>(value);

  useEffect(() => {
    setFormValue(value);
  }, [value]);

  const visibleWarning = useMemo(() => {
    if (!warningCode) {
      return null;
    }
    if (dismissedWarningCodes.includes(warningCode)) {
      return null;
    }
    return warningCode;
  }, [dismissedWarningCodes, warningCode]);

  const fieldErrors = useMemo(() => {
    const map = {
      apiBase: [] as RuntimeConfigValidationError[],
      wsUrl: [] as RuntimeConfigValidationError[],
    };
    for (const error of validationErrors) {
      map[error.field].push(error);
    }
    return map;
  }, [validationErrors]);

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
      <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
        {t("settingsEndpointTitle")}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
        {t("settingsEndpointDescription")}
      </p>

      {visibleWarning ? (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-[color:var(--warning)]">
          <p>{t(warningMessageKey(visibleWarning) ?? "settingsMutationFailed")}</p>
          <button
            type="button"
            onClick={() => onDismissWarning(visibleWarning)}
            className="shrink-0 rounded-lg border border-amber-500/35 px-2 py-1 text-xs font-semibold"
          >
            {t("settingsDismissWarning")}
          </button>
        </div>
      ) : null}

      {actionErrorMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-500/35 bg-rose-500/10 p-3 text-sm text-[color:var(--danger)]">
          {actionErrorMessage}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4">
        <label className="grid gap-1 text-sm text-[color:var(--text-secondary)]">
          <span className="font-semibold text-[color:var(--text-primary)]">
            {t("settingsApiBaseLabel")}
          </span>
          <input
            type="text"
            value={formValue.apiBase}
            onChange={(event) =>
              setFormValue((current) => ({ ...current, apiBase: event.target.value }))
            }
            className="mono rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          {fieldErrors.apiBase.map((error) => (
            <span key={`${error.code}-${error.field}`} className="text-xs text-[color:var(--danger)]">
              {error.message}
            </span>
          ))}
        </label>

        <label className="grid gap-1 text-sm text-[color:var(--text-secondary)]">
          <span className="font-semibold text-[color:var(--text-primary)]">
            {t("settingsWsUrlLabel")}
          </span>
          <input
            type="text"
            value={formValue.wsUrl}
            onChange={(event) =>
              setFormValue((current) => ({ ...current, wsUrl: event.target.value }))
            }
            className="mono rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[color:var(--text-primary)]"
          />
          {fieldErrors.wsUrl.map((error) => (
            <span key={`${error.code}-${error.field}`} className="text-xs text-[color:var(--danger)]">
              {error.message}
            </span>
          ))}
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave(formValue)}
          disabled={isSaving}
          className="rounded-xl border border-[color:rgba(15,118,110,0.35)] bg-[color:var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--accent)] disabled:opacity-50"
        >
          {isSaving ? t("settingsSaving") : t("settingsSave")}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={isSaving}
          className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--text-secondary)] disabled:opacity-50"
        >
          {t("settingsReset")}
        </button>
      </div>
    </section>
  );
}
