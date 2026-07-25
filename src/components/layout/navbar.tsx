"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ShoppingBag, User, LayoutDashboard, LogOut } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/menu", label: "Menú" },
  { href: "/juegos", label: "Juegos" },
  { href: "/#historia", label: "Nuestra historia" },
  { href: "/#contacto", label: "Contacto" },
];

export function Navbar() {
  const { data: session } = useSession();
  const { itemCount } = useCart();
  const [open, setOpen] = React.useState(false);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-300",
          scrolled
            ? "border-b border-charcoal-100/80 bg-cream/90 shadow-sm backdrop-blur-md dark:border-charcoal-700 dark:bg-charcoal-900/90"
            : "bg-transparent"
        )}
      >
        <nav className="container-lm flex h-20 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo_LaMordida.jpg"
              alt="La Mordida"
              width={44}
              height={44}
              priority
              className="h-11 w-11 rounded-full object-cover ring-1 ring-charcoal-900/10 dark:ring-cream/20"
            />
            <span className="hidden font-display text-2xl tracking-wide sm:inline">
              <span className="text-charcoal-900 dark:text-cream">LA</span>{" "}
              <span className="text-ember-600">MORDIDA</span>
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-semibold text-charcoal-700 transition-colors hover:text-ember-600 dark:text-charcoal-100"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <button
              onClick={() => setCartOpen(true)}
              aria-label="Ver carrito"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-charcoal-100 dark:text-cream dark:hover:bg-charcoal-700"
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ember-600 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </button>

            {session?.user ? (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-100 text-charcoal-700 transition-colors hover:bg-charcoal-200 dark:bg-charcoal-700 dark:text-cream"
                >
                  <User className="h-5 w-5" />
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-charcoal-100 bg-white py-1 shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800"
                    >
                      <div className="border-b border-charcoal-100 px-4 py-2 text-sm dark:border-charcoal-700">
                        <p className="font-semibold text-charcoal-900 dark:text-cream">{session.user.name}</p>
                        <p className="truncate text-xs text-charcoal-400">{session.user.email}</p>
                      </div>
                      <Link
                        href="/cuenta"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-charcoal-700 hover:bg-charcoal-50 dark:text-cream dark:hover:bg-charcoal-700"
                      >
                        <LayoutDashboard className="h-4 w-4" /> Mi cuenta
                      </Link>
                      {session.user.role === "ADMIN" && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-charcoal-700 hover:bg-charcoal-50 dark:text-cream dark:hover:bg-charcoal-700"
                        >
                          <LayoutDashboard className="h-4 w-4" /> Panel admin
                        </Link>
                      )}
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <LogOut className="h-4 w-4" /> Cerrar sesión
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href="/login" className="hidden md:block">
                <Button size="sm">Ingresar</Button>
              </Link>
            )}

            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              className="flex h-10 w-10 items-center justify-center rounded-full text-charcoal-700 dark:text-cream md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-charcoal-900/60 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 flex h-full w-[80%] max-w-sm flex-col bg-cream p-6 dark:bg-charcoal-900"
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="font-display text-2xl">MENÚ</span>
                <button onClick={() => setOpen(false)} aria-label="Cerrar menú">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="font-display text-2xl tracking-wide text-charcoal-800 dark:text-cream"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3">
                {session?.user ? (
                  <>
                    <Link href="/cuenta" onClick={() => setOpen(false)}>
                      <Button variant="secondary" className="w-full">
                        Mi cuenta
                      </Button>
                    </Link>
                    {session.user.role === "ADMIN" && (
                      <Link href="/admin" onClick={() => setOpen(false)}>
                        <Button variant="outline" className="w-full">
                          Panel admin
                        </Button>
                      </Link>
                    )}
                    <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
                      Cerrar sesión
                    </Button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setOpen(false)}>
                    <Button className="w-full">Ingresar</Button>
                  </Link>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
