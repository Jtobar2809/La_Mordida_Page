"use client";

import { motion } from "framer-motion";
import { staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AnimatedTitleProps {
  children: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
  amount?: number;
}

const word: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Título con reveal palabra-por-palabra + blur (efecto hero cinematográfico).
 * Usa font-display por defecto para alinear con la identidad tipográfica
 * de la marca. `children` debe ser un string plano (se divide en palabras).
 */
export function AnimatedTitle({
  children,
  className,
  as = "h2",
  amount = 0.4,
}: AnimatedTitleProps) {
  const Tag = motion[as];
  const words = children.split(" ");

  return (
    <Tag
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: false, amount }}
      className={cn(
        "font-display tracking-wide text-charcoal-900 dark:text-cream",
        className
      )}
    >
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          variants={word}
          className="inline-block will-change-transform"
        >
          {w}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </Tag>
  );
}
