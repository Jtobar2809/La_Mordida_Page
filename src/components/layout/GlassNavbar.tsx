"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassNavbarProps {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

/**
 * Barra de vidrio (glassmorphism) reutilizable — para toolbars flotantes,
 * filtros de menú, o cualquier barra secundaria dentro de una sección.
 * No reemplaza a components/layout/navbar.tsx (que maneja sesión, carrito
 * y navegación principal); esto es una pieza genérica del design system.
 */
export function GlassNavbar({
  children,
  className,
  sticky = false,
}: GlassNavbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "z-30 flex items-center gap-4 rounded-full border border-white/20 bg-white/60 px-5 py-3 shadow-premium backdrop-blur-xl dark:border-white/10 dark:bg-charcoal-800/50",
        sticky && "sticky top-4",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
