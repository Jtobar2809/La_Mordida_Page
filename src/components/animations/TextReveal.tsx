"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextRevealProps {
  lines: string[];
  className?: string;
  amount?: number;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const line = {
  hidden: { y: "100%" },
  visible: {
    y: "0%",
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Revela un bloque de texto línea por línea con máscara de overflow
 * (cada línea "sube" desde abajo, como en Linear marketing pages).
 * Recibe `lines` como array explícito en vez de un solo string, para
 * controlar exactamente dónde corta cada línea.
 */
export function TextReveal({ lines, className, amount = 0.4 }: TextRevealProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      className={className}
    >
      {lines.map((text, i) => (
        <div key={i} className="overflow-hidden">
          <motion.div variants={line} className={cn("will-change-transform")}>
            {text}
          </motion.div>
        </div>
      ))}
    </motion.div>
  );
}
