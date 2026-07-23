"use client";

import * as React from "react";
import { motion, useMotionValue, useMotionTemplate, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Se parte de HTMLMotionProps<"button"> (no de React.ButtonHTMLAttributes)
 * porque motion.button espera sus propios tipos de evento para onDrag,
 * onDragStart, onAnimationStart, etc. — incompatibles con los del DOM
 * nativo. Extender los props HTML normales y luego hacer spread sobre
 * motion.button produce un choque de tipos entre ambos onDrag.
 */
export interface GlowButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
}

/**
 * Botón premium con glow que sigue al cursor (estilo Linear/Raycast CTA).
 * Para botones estándar del producto (forms, admin, acciones), usar
 * components/ui/button.tsx — este es específicamente para CTAs hero/landing.
 */
export const GlowButton = React.forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ children, className, ...props }, ref) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    }

    const background = useMotionTemplate`radial-gradient(160px circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.35), transparent 70%)`;

    return (
      <motion.button
        ref={ref}
        onMouseMove={handleMouseMove}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "group relative overflow-hidden rounded-full bg-ember-gradient px-8 py-3.5 text-sm font-semibold text-white shadow-glow transition-shadow duration-300 hover:shadow-[0_0_55px_-6px_rgba(232,92,43,0.8)]",
          className
        )}
        {...props}
      >
        <motion.span
          className="pointer-events-none absolute inset-0"
          style={{ background }}
        />
        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  }
);
GlowButton.displayName = "GlowButton";
