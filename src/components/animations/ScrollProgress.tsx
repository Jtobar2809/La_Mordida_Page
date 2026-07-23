"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/**
 * Barra de progreso de scroll fijada arriba de la página (estilo Linear docs).
 * Montar una sola vez, típicamente en el layout raíz, fuera del <main>.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className="fixed left-0 top-0 z-[90] h-[3px] w-full origin-left bg-ember-gradient"
      style={{ scaleX }}
    />
  );
}
