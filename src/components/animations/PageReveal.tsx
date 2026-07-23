"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SESSION_KEY = "lm_page_reveal_shown";

/**
 * Cortina de revelado en la carga inicial de la sesión del navegador —
 * un panel del color de marca que se retira hacia arriba al montar,
 * dando la sensación de "abrir telón" (estilo agencias creativas
 * premium). Se muestra una sola vez por sesión de pestaña (sessionStorage),
 * no en cada navegación interna — así "toda la app" tiene el efecto sin
 * que se vuelva repetitivo mientras el usuario navega entre rutas.
 * Distinto de PageTransition (que anima cruces de ruta dentro de la SPA).
 * Montar en el layout raíz, antes de {children}.
 */
export function PageReveal() {
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // sessionStorage no disponible (modo privado estricto, etc.) — mostrar igual
    }

    if (alreadyShown) {
      setVisible(false);
      return;
    }

    setShouldRender(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // ignorar si no se puede persistir
      }
    }, reducedMotion ? 0 : 500);

    return () => clearTimeout(timer);
  }, []);

  if (!shouldRender) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-char-gradient"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="font-display text-3xl tracking-wide text-cream"
          >
            LA <span className="text-ember-500">MORDIDA</span>
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
