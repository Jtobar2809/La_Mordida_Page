"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type CursorMode = "default" | "interactive" | "text";

/**
 * Cursor personalizado afín a la identidad de La Mordida: un punto ember
 * sólido que sigue al mouse al instante, con un anillo que lo persigue
 * con inercia (spring). Reacciona a 3 estados:
 *  - default: punto + anillo delgado
 *  - interactive (links/botones): anillo se agranda y se llena levemente
 *  - text (inputs/textarea): anillo colapsa a una barra vertical (I-beam)
 * También da feedback de click (scale down) para sensación táctil.
 * Se auto-desactiva en touch y con prefers-reduced-motion, y oculta el
 * cursor nativo del sistema únicamente cuando está activo (vía clase en
 * <html>), para no duplicar cursores ni afectar SSR/otros dispositivos.
 */
export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<CursorMode>("default");
  const [pressed, setPressed] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const ringX = useSpring(cursorX, { stiffness: 320, damping: 28 });
  const ringY = useSpring(cursorY, { stiffness: 320, damping: 28 });

  useEffect(() => {
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!hasFinePointer || reducedMotion) return;

    setEnabled(true);
    document.documentElement.classList.add("custom-cursor-active");

    function handleMove(e: MouseEvent) {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable='true']")) {
        setMode("text");
      } else if (target.closest("a, button, [role='button'], select, .cursor-interactive")) {
        setMode("interactive");
      } else {
        setMode("default");
      }
    }

    function handleDown() {
      setPressed(true);
    }
    function handleUp() {
      setPressed(false);
    }
    function handleLeaveWindow() {
      cursorX.set(-100);
      cursorY.set(-100);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);
    document.documentElement.addEventListener("mouseleave", handleLeaveWindow);

    return () => {
      document.documentElement.classList.remove("custom-cursor-active");
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
      document.documentElement.removeEventListener("mouseleave", handleLeaveWindow);
    };
  }, [cursorX, cursorY]);

  if (!enabled) return null;

  const isText = mode === "text";
  const isInteractive = mode === "interactive";

  return (
    <>
      {/* Punto central — siempre visible, marca la posición exacta */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[100] rounded-full bg-ember-500"
        style={{ x: cursorX, y: cursorY, translateX: "-50%", translateY: "-50%" }}
        animate={{
          width: isText ? 2 : 6,
          height: isText ? 18 : 6,
          borderRadius: isText ? 1 : 999,
          scale: pressed ? 0.7 : 1,
        }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      />

      {/* Anillo — sigue con inercia, da el estado (default/hover/texto) */}
      {!isText && (
        <motion.div
          className="pointer-events-none fixed left-0 top-0 z-[100] rounded-full border border-ember-500/50"
          style={{ x: ringX, y: ringY, translateX: "-50%", translateY: "-50%" }}
          animate={{
            width: isInteractive ? 46 : 26,
            height: isInteractive ? 46 : 26,
            opacity: isInteractive ? 0.9 : 0.35,
            backgroundColor: isInteractive ? "rgba(232,92,43,0.08)" : "rgba(232,92,43,0)",
            scale: pressed ? 0.85 : 1,
          }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      )}
    </>
  );
}
