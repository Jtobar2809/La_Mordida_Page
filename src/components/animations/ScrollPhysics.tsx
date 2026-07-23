"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform, useVelocity } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScrollPhysicsProps {
  children: React.ReactNode;
  className?: string;
  skewStrength?: number;
}

/**
 * Aplica un leve "skew" dinámico basado en la velocidad de scroll —
 * el contenido se inclina levemente al hacer scroll rápido y vuelve a
 * su posición natural al detenerse (efecto usado en sitios premium tipo
 * agencias creativas). Sutil por diseño: skewStrength bajo por defecto.
 */
export function ScrollPhysics({
  children,
  className,
  skewStrength = 0.06,
}: ScrollPhysicsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(velocity, { stiffness: 300, damping: 40 });
  const skew = useTransform(smoothVelocity, [-2000, 2000], [-skewStrength * 100, skewStrength * 100]);

  return (
    <motion.div ref={ref} style={{ skewY: skew }} className={cn(className)}>
      {children}
    </motion.div>
  );
}
