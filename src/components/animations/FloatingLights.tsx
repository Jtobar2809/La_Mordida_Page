"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FloatingLightsProps {
  className?: string;
  count?: number;
}

const palette = ["bg-ember-400/40", "bg-mustard-400/40", "bg-ember-300/30"] as const;

/**
 * Campo de pequeñas luces ambientales flotando a distintas velocidades —
 * capa de atmósfera adicional a GradientBackground (blobs grandes).
 * Usar sobre fondos oscuros (bg-char-gradient) para mejor contraste.
 * El padre debe tener position: relative.
 */
export function FloatingLights({ className, count = 14 }: FloatingLightsProps) {
  const lights = Array.from({ length: count }).map((_, i) => ({
    id: i,
    size: 3 + ((i * 7) % 6),
    left: (i * 137.5) % 100,
    top: (i * 71.3) % 100,
    duration: 6 + (i % 5) * 1.5,
    delay: (i % 4) * 0.8,
    color: palette[i % palette.length] ?? palette[0],
  }));

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      {lights.map((l) => (
        <motion.span
          key={l.id}
          className={cn("absolute rounded-full blur-[2px]", l.color)}
          style={{
            width: l.size,
            height: l.size,
            left: `${l.left}%`,
            top: `${l.top}%`,
          }}
          animate={{
            y: [0, -24, 0],
            opacity: [0.2, 0.9, 0.2],
          }}
          transition={{
            duration: l.duration,
            delay: l.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
