"use client";

import * as React from "react";

/**
 * Ajusta el buffer del canvas a la densidad real de la pantalla.
 *
 * Los canvas de los juegos declaran un "mundo" en coordenadas lógicas
 * (ej. 800x320) y se estiran por CSS al ancho disponible. En pantallas
 * retina/móviles (devicePixelRatio 2–3) ese estirado hace que todo se
 * vea borroso, que es la mitad de por qué los juegos se sentían baratos.
 * Este hook multiplica el buffer por el DPR y deja el contexto escalado,
 * así el resto del código sigue dibujando en coordenadas lógicas sin
 * cambiar una sola línea.
 *
 * El DPR se limita a 2: por encima de eso el costo de rellenar píxeles
 * crece rápido (3x = 9x el área) y la ganancia visual es imperceptible.
 */
export function useHiDpiCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  worldWidth: number,
  worldHeight: number
) {
  const dprRef = React.useRef(1);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function apply() {
      const el = canvasRef.current;
      if (!el) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      dprRef.current = dpr;
      const w = Math.round(worldWidth * dpr);
      const h = Math.round(worldHeight * dpr);
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
    }

    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [canvasRef, worldWidth, worldHeight]);

  return dprRef;
}

/**
 * Prepara el contexto para dibujar un frame en coordenadas lógicas:
 * reinicia la matriz al DPR actual y limpia el mundo entero.
 */
export function beginFrame(ctx: CanvasRenderingContext2D, dpr: number, worldWidth: number, worldHeight: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, worldWidth, worldHeight);
}
