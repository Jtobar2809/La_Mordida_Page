"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GradientBackgroundProps {
  className?: string;
  variant?: "ember" | "char";
}

/**
 * Fondo dinámico con blobs de gradiente animados (estilo Linear/Raycast).
 * Se posiciona absolute detrás del contenido — el padre debe tener
 * position: relative. Usa los tokens de marca (ember/mustard/charcoal),
 * respeta reduced-motion vía las mismas keyframes de globals.css.
 */
export function GradientBackground({
  className,
  variant = "ember",
}: GradientBackgroundProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className
      )}
      aria-hidden
    >
      <motion.div
        className={cn(
          "absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full blur-[120px]",
          variant === "ember"
            ? "bg-ember-500/30"
            : "bg-charcoal-700/40"
        )}
        animate={{
          x: [0, 40, 0],
          y: [0, 30, 0],
          scale: [1, 1.08, 1],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 h-[26rem] w-[26rem] rounded-full bg-mustard-400/25 blur-[110px]"
        animate={{
          x: [0, -30, 0],
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      <div className="absolute inset-0 bg-cream/40 dark:bg-charcoal-900/60" />
    </div>
  );
}
