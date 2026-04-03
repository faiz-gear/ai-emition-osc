"use client";

import React from "react";

import { ProviderManager, type ProviderManagerTransport } from "@/components/ProviderManager";
import { useI18n } from "@/lib/i18n";

type SettingsProviderSectionProps = {
  transport: ProviderManagerTransport;
};

export function SettingsProviderSection({
  transport,
}: SettingsProviderSectionProps) {
  const { t } = useI18n();

  return (
    <section
      data-testid="provider-section"
      className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-5"
    >
      <h2 className="text-base font-semibold text-[color:var(--text-primary)]">
        {t("settingsProviderTitle")}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
        {t("settingsProviderDescription")}
      </p>

      <fieldset className="mt-4 min-w-0">
        <ProviderManager
          transport={transport}
          activeProviderId={null}
        />
      </fieldset>
    </section>
  );
}
