"use client";

import * as React from "react";
import type { DEFAULT_SETTINGS } from "@/lib/settings";

export type SiteSettings = typeof DEFAULT_SETTINGS;

const SettingsContext = React.createContext<SiteSettings | null>(null);

/**
 * Los settings se obtienen UNA sola vez por request en el servidor
 * (src/app/layout.tsx -> getSettings()) y se inyectan aquí. Antes,
 * componentes como Footer hacían su propio fetch("/api/settings") en
 * cada montaje, duplicando consultas a Prisma en cada navegación y
 * agotando el connection pool (P2024 "Timed out fetching a new
 * connection"). Con este Provider ya no hace falta ningún fetch
 * adicional en el cliente para leer estos valores.
 */
export function SettingsProvider({
  settings,
  children,
}: {
  settings: SiteSettings;
  children: React.ReactNode;
}) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SiteSettings {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings debe usarse dentro de <SettingsProvider>");
  return ctx;
}
