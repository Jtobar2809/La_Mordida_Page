"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedBorderProps {
  children: React.ReactNode;
  className?: string;
  borderRadius?: string;
}

/**
 * Borde con gradiente cónico rotando infinitamente — para destacar un
 * elemento clave (ej. la card de producto "estrella" o un CTA premium).
 * Usar con moderación: es un efecto fuerte, no para uso masivo en grids.
 */
export function AnimatedBorder({
  children,
  className,
  borderRadius = "1rem",
}: AnimatedBorderProps) {
  return (
    <div
      className={cn("relative p-[1.5px] overflow-hidden", className)}
      style={{ borderRadius }}
    >
      <motion.div
        className="absolute inset-[-50%]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, #E85C2B 15%, #F0A93A 30%, transparent 45%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      <div
        className="relative bg-cream dark:bg-charcoal-900"
        style={{ borderRadius: `calc(${borderRadius} - 1.5px)` }}
      >
        {children}
      </div>
    </div>
  );
}
