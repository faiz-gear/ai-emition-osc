"use client";

import React, { useEffect, useState } from "react";

import { ProviderManager } from "@/components/ProviderManager";
import { PROVIDER_PANEL_STORAGE_KEY } from "@/lib/dashboard/types";

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
    <section className="dashboard-enter rounded-[var(--radius-lg)] border border-[color:var(--border)] bg-[color:var(--surface)] p-[var(--space-3)] shadow-[0_8px_22px_rgba(17,19,24,0.05)]">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1 text-left hover:bg-[color:rgba(17,19,24,0.04)]"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          Advanced
        </span>
        <span className="mono text-xs text-[color:var(--text-secondary)]">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open ? (
        <div className="mt-2">
          {children ??
            (mounted && apiBase ? (
              <ProviderManager apiBase={apiBase} activeProviderId={activeProviderId} />
            ) : null)}
        </div>
      ) : null}
    </section>
  );
}
