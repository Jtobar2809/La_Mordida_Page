"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/inventario/resumen", label: "Resumen" },
  { href: "/admin/inventario", label: "Insumos" },
  { href: "/admin/inventario/recetas", label: "Recetas" },
  { href: "/admin/inventario/costos", label: "Costos fijos" },
  { href: "/admin/inventario/produccion", label: "Producción" },
  { href: "/admin/inventario/proveedores", label: "Proveedores" },
  { href: "/admin/inventario/compras", label: "Compras" },
  { href: "/admin/inventario/mermas", label: "Mermas" },
  { href: "/admin/inventario/conteo", label: "Conteo" },
];

export function InventarioTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "rounded-full bg-ember-gradient px-4 py-2 font-medium text-white shadow-glow"
                : "rounded-full px-4 py-2 font-medium text-charcoal-600 hover:bg-charcoal-100 dark:text-cream dark:hover:bg-charcoal-700/50"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
