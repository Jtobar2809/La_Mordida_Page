"use client";

import { motion } from "framer-motion";
import { fadeIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  amount?: number;
}

/**
 * Wrapper de sección para full-page sections (Hero, CTA, Menú, etc).
 * Combina fade-in con viewport detection para que cada bloque de la
 * página respire al entrar en pantalla, sin repetir boilerplate de
 * motion en cada page-level section.
 */
export function AnimatedSection({
  children,
  className,
  id,
  amount = 0.2,
}: AnimatedSectionProps) {
  return (
    <motion.section
      id={id}
      variants={fadeIn}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      className={cn("relative", className)}
    >
      {children}
    </motion.section>
  );
}
