"use client";

import React, { useEffect, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

import { ProviderManager } from "@/components/ProviderManager";
import { PROVIDER_PANEL_STORAGE_KEY } from "@/lib/dashboard/types";
import { useI18n } from "@/lib/i18n";

type ProviderAdvancedPanelProps = {
  apiBase?: string;
  activeProviderId?: string | null;
  children?: React.ReactNode;
};

export function ProviderAdvancedPanel({
  apiBase,
  activeProviderId = null,
  children,
}: ProviderAdvancedPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(PROVIDER_PANEL_STORAGE_KEY);
      setOpen(saved === "true");
    } catch {
      setOpen(false);
    }
  }, []);

  const toggleOpen = () => {
    setOpen((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(PROVIDER_PANEL_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors and continue with in-memory state.
      }
      return next;
    });
  };

  return (
    <section className="dashboard-enter rounded-[2.25rem] border border-white/65 bg-[color:rgba(255,255,255,0.82)] p-5 shadow-[0_20px_40px_-28px_rgba(18,25,20,0.3),inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-md">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[color:rgba(21,26,23,0.08)] bg-[color:var(--surface-muted)] px-3 py-2 text-left transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-white active:-translate-y-[1px]"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-secondary)]">
          {t("advanced")}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-[color:var(--text-secondary)]">
          {open ? t("hide") : t("show")}
          <CaretDown
            size={14}
            weight="bold"
            className={`transition-transform duration-300 ${open ? "rotate-180" : "rotate-0"}`}
          />
        </span>
      </button>

      {open ? (
        <div className="mt-3">
          {children ??
            (mounted && apiBase ? (
              <ProviderManager apiBase={apiBase} activeProviderId={activeProviderId} />
            ) : null)}
        </div>
      ) : null}
    </section>
  );
}
