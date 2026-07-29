"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Beef,
  Tag,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  Image as ImageIcon,
  Percent,
  Stamp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/productos", label: "Productos", icon: Beef },
  { href: "/admin/categorias", label: "Categorías", icon: Tag },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/sellos", label: "Tarjeta de sellos", icon: Stamp },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon },
  { href: "/admin/cupones", label: "Cupones", icon: Percent },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export function AdminTopbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-charcoal-100 bg-white px-5 dark:border-charcoal-700 dark:bg-charcoal-800 lg:justify-end">
      <button onClick={() => setOpen(true)} className="lg:hidden" aria-label="Abrir menú admin">
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex items-center gap-3">
        <span className="text-sm text-charcoal-500 dark:text-charcoal-300">{session?.user?.name}</span>
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-charcoal-400 hover:text-red-500" aria-label="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-charcoal-900/60 lg:hidden" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="h-full w-72 bg-charcoal-900 p-4 text-cream">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-xl">MENÚ ADMIN</span>
              <button onClick={() => setOpen(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {links.map(({ href, label, icon: Icon }) => {
                const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      active ? "bg-ember-gradient text-white" : "text-charcoal-300 hover:bg-charcoal-800"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
