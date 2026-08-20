"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/contabilidad", label: "Estado de resultados" },
  { href: "/admin/contabilidad/conciliacion", label: "Conciliación" },
];

/** Conserva el mes seleccionado al saltar de pestaña. */
export function ContabilidadTabs({ anio, mes }: { anio: number; mes: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {TABS.map((tab) => {
        const activo = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={`${tab.href}?anio=${anio}&mes=${mes}`}
            className={
              activo
                ? "rounded-full bg-charcoal-800 px-4 py-2 font-medium text-white dark:bg-cream dark:text-charcoal-900"
                : "rounded-full px-4 py-2 font-medium text-charcoal-500 hover:bg-charcoal-100 dark:text-charcoal-300 dark:hover:bg-charcoal-700/50"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
