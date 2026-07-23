"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface MouseParallaxProps {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}

/**
 * Desplaza su contenido levemente según la posición del cursor dentro
 * del contenedor — profundidad sutil estilo Linear/Raycast hero sections.
 * `strength` controla el desplazamiento máximo en px.
 */
export function MouseParallax({
  children,
  strength = 20,
  className,
}: MouseParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 150, damping: 20 });
  const springY = useSpring(y, { stiffness: 150, damping: 20 });

  const translateX = useTransform(springX, [-0.5, 0.5], [-strength, strength]);
  const translateY = useTransform(springY, [-0.5, 0.5], [-strength, strength]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      <motion.div style={{ x: translateX, y: translateY }}>
        {children}
      </motion.div>
    </div>
  );
}
