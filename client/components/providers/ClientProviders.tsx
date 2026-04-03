"use client";

import React from "react";

import { DashboardI18nProvider } from "@/lib/i18n";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <DashboardI18nProvider>{children}</DashboardI18nProvider>;
}
