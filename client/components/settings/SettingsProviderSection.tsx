"use client";

import React from "react";

import { ProviderManager } from "@/components/ProviderManager";
import { useI18n } from "@/lib/i18n";

type SettingsProviderSectionProps = {
  apiBase: string;
  apiBaseRevision: number;
  isEndpointMutating: boolean;
};

export function SettingsProviderSection({
  apiBase,
  apiBaseRevision,
  isEndpointMutating,
}: SettingsProviderSectionProps) {
  const { t } = useI18n();

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5">
      <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
        {t("settingsProviderTitle")}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
        {t("settingsProviderDescription")}
      </p>

      <fieldset className="mt-4 min-w-0" disabled={isEndpointMutating}>
        <ProviderManager
          key={`provider-manager-${apiBaseRevision}`}
          apiBase={apiBase}
          activeProviderId={null}
        />
      </fieldset>
    </section>
  );
}
