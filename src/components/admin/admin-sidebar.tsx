"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { adminNavLinks } from "@/lib/admin-nav";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-charcoal-700 bg-charcoal-900 p-4 lg:block">
      <Link href="/" className="mb-8 block px-2 font-display text-2xl tracking-wide text-cream">
        LA <span className="text-ember-500">MORDIDA</span>
      </Link>
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-charcoal-500">Panel admin</p>
      <nav className="space-y-1">
        {adminNavLinks.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-ember-gradient text-white shadow-glow" : "text-charcoal-300 hover:bg-charcoal-800 hover:text-cream"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
