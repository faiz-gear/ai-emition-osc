"use client";

import React, { useMemo } from "react";

import type { DownloadStatus } from "@ai-emotion/contracts";

import { useI18n } from "@/lib/i18n";
import type { AsrModelCatalogItem, InstalledAsrModel } from "@/lib/types";

export type AsrModelDownloadState = {
  status: DownloadStatus;
  progressPercent: number | null;
};

type SettingsAsrModelSectionProps = {
  catalog: AsrModelCatalogItem[];
  installedModels: InstalledAsrModel[];
  downloadStates: Record<string, AsrModelDownloadState | undefined>;
  listening: boolean;
  onDownloadModel: (modelId: string) => void;
  onActivateModel: (modelId: string) => void;
  onDeleteModel: (modelId: string) => void;
};

function languageLabelKey(language: AsrModelCatalogItem["language"]) {
  switch (language) {
    case "en":
      return "settingsAsrModelLanguageEn";
    case "zh":
      return "settingsAsrModelLanguageZh";
    default:
      return "settingsAsrModelLanguageMultilingual";
  }
}

function statusLabelKey(status: DownloadStatus) {
  switch (status) {
    case "queued":
      return "settingsAsrModelStatusQueued";
    case "downloading":
      return "settingsAsrModelStatusDownloading";
    case "verifying":
      return "settingsAsrModelStatusVerifying";
    case "ready":
      return "settingsAsrModelStatusReady";
    case "failed":
      return "settingsAsrModelStatusFailed";
    default:
      return "settingsAsrModelStatusNotInstalled";
  }
}

function formatSizeMb(sizeBytes: number) {
  return Math.round(sizeBytes / 1024 / 1024);
}

export function SettingsAsrModelSection({
  catalog,
  installedModels,
  downloadStates,
  listening,
  onDownloadModel,
  onActivateModel,
  onDeleteModel,
}: SettingsAsrModelSectionProps) {
  const { t } = useI18n();
  const installedByModelId = useMemo(() => {
    return new Map(installedModels.map((model) => [model.modelId, model]));
  }, [installedModels]);

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
      <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
        {t("settingsAsrModelTitle")}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
        {t("settingsAsrModelDescription")}
      </p>
      {listening ? (
        <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm text-[color:var(--warning)]">
          {t("settingsAsrModelListeningBlocked")}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {catalog.map((model) => {
          const installed = installedByModelId.get(model.modelId);
          const downloadState = downloadStates[model.modelId];
          const isActive = installed?.active === true;
          const isInstalled = Boolean(installed);
          const canDownload =
            !isInstalled &&
            (downloadState === undefined || downloadState.status === "failed");
          const canActivate = isInstalled && !isActive && !listening;
          const canDelete = isInstalled && !isActive && !listening;

          return (
            <article
              key={model.modelId}
              className="rounded-2xl border border-[color:var(--border)] bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {model.name}
                    </h3>
                    {model.recommended ? (
                      <span className="rounded-full border border-[color:rgba(15,118,110,0.24)] bg-[color:var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
                        {t("settingsAsrModelRecommended")}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    {t(languageLabelKey(model.language))} ·{" "}
                    {t("settingsAsrModelSize", { sizeMb: formatSizeMb(model.sizeBytes) })}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2 py-1 text-xs text-[color:var(--text-secondary)]">
                    {downloadState
                      ? t(statusLabelKey(downloadState.status))
                      : isActive
                        ? t("settingsAsrModelStatusActive")
                        : isInstalled
                          ? t("settingsAsrModelStatusInstalled")
                          : t("settingsAsrModelStatusNotInstalled")}
                  </span>
                  {canDownload ? (
                    <button
                      type="button"
                      onClick={() => onDownloadModel(model.modelId)}
                      className="rounded-xl border border-[color:rgba(15,118,110,0.35)] bg-[color:var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent)]"
                    >
                      {t("settingsAsrModelDownload")}
                    </button>
                  ) : null}
                  {isInstalled ? (
                    <button
                      type="button"
                      onClick={() => onActivateModel(model.modelId)}
                      disabled={!canActivate}
                      className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--text-primary)] disabled:opacity-50"
                    >
                      {t("settingsAsrModelActivate")}
                    </button>
                  ) : null}
                  {isInstalled ? (
                    <button
                      type="button"
                      onClick={() => onDeleteModel(model.modelId)}
                      disabled={!canDelete}
                      className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--danger)] disabled:opacity-50"
                    >
                      {t("settingsAsrModelDelete")}
                    </button>
                  ) : null}
                </div>
              </div>

              {downloadState && downloadState.progressPercent !== null ? (
                <p className="mt-3 text-xs text-[color:var(--text-secondary)]">
                  {t("settingsAsrModelDownloadProgress", {
                    status: t(statusLabelKey(downloadState.status)),
                    progress: downloadState.progressPercent,
                  })}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
