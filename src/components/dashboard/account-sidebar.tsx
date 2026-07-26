"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Gift, Trophy, UserRound, Stamp } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/cuenta", label: "Resumen", icon: LayoutDashboard },
  { href: "/cuenta/pedidos", label: "Mis pedidos", icon: Package },
  { href: "/cuenta/sellos", label: "Tarjeta de sellos", icon: Stamp },
  { href: "/cuenta/recompensas", label: "Recompensas", icon: Gift },
  { href: "/cuenta/desafios", label: "Desafíos", icon: Trophy },
  { href: "/cuenta/perfil", label: "Mi perfil", icon: UserRound },
];

export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:pb-0">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
              active
                ? "bg-ember-gradient text-white shadow-glow"
                : "text-charcoal-600 hover:bg-charcoal-100 dark:text-charcoal-200 dark:hover:bg-charcoal-700"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
