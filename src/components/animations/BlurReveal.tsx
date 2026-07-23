"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BlurRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  amount?: number;
}

const variants = {
  hidden: { opacity: 0, filter: "blur(12px)", y: 16 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Reveal con desenfoque progresivo — para elementos destacados (títulos
 * hero, imágenes protagonistas) donde el fade+blur da más sensación de
 * "enfoque" que el slide-up estándar de Reveal.
 */
export function BlurReveal({
  children,
  className,
  delay = 0,
  amount = 0.3,
}: BlurRevealProps) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount }}
      transition={{ delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
