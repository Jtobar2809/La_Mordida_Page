"use client";

import { motion, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";

interface MotionLayoutProps {
  children: React.ReactNode;
  className?: string;
  id?: string | number;
}

/**
 * Item con layout animation automática: cuando cambia su posición en el
 * DOM (por filtrado, reordenamiento, o inserción/remoción de hermanos),
 * Framer Motion anima la transición en vez de saltar. Ideal para grids
 * filtrables (ej. categorías del menú, listas del admin).
 */
export function MotionLayoutItem({ children, className, id }: MotionLayoutProps) {
  return (
    <motion.div
      layout
      key={id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Agrupa varios MotionLayoutItem para que coordinen sus animaciones de
 * layout entre sí (por ejemplo, un grid completo de productos filtrables).
 * Envolver el contenedor del grid con esto.
 */
export function MotionLayoutGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <LayoutGroup>
      <div className={cn(className)}>{children}</div>
    </LayoutGroup>
  );
}
