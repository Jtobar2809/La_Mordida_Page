"use client";

import * as React from "react";
import { motion } from "framer-motion";

export type MordiExpression =
  | "happy"
  | "surprised"
  | "wink"
  | "dizzy"
  | "determined"
  | "cool"
  | "love"
  | "sad";

interface MordiSpriteProps {
  className?: string;
  expression?: MordiExpression;
  /** Flotación sutil de la cabeza. Desactívala en grillas grandes (memorama) para no animar 12 sprites a la vez. */
  animate?: boolean;
  /** Halo cálido detrás del personaje — úsalo cuando Mordi es el foco de la escena. */
  glow?: boolean;
}

/**
 * Ilustración vectorial de Mordi (SVG inline), mascota de los minijuegos.
 *
 * Se construyó en SVG en vez de depender del PNG (/MordiSinFondo.png)
 * porque dentro de contenedores con transforms 3D complejos (flip de
 * cartas, motion.div anidados con rotateY/scale), next/image con `fill`
 * puede fallar a resolver su tamaño en el primer paint y quedar
 * invisible. Un SVG inline no depende de una petición de red ni de que
 * el layout del contenedor ya esté asentado — siempre se pinta.
 *
 * v2: volumen real (gradientes radiales + luz de borde + oclusión bajo
 * el pan), relleno de ingredientes visible entre los panes, y 8
 * expresiones para que la mascota reaccione al estado de cada juego.
 * Los ids de los <defs> se derivan de useId() porque en una misma
 * pantalla conviven muchos sprites (12 en el memorama) y los ids
 * duplicados en un documento SVG son ambiguos.
 */
export function MordiSprite({
  className,
  expression = "happy",
  animate = true,
  glow = false,
}: MordiSpriteProps) {
  const uid = React.useId().replace(/:/g, "");
  const id = (name: string) => `${name}-${uid}`;

  return (
    <svg viewBox="0 0 120 124" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={id("bunTop")} cx="34%" cy="24%" r="82%">
          <stop offset="0%" stopColor="#FFD98A" />
          <stop offset="55%" stopColor="#F0A93A" />
          <stop offset="100%" stopColor="#D07E1A" />
        </radialGradient>
        <linearGradient id={id("bunBottom")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E4AE68" />
          <stop offset="100%" stopColor="#AC6512" />
        </linearGradient>
        <linearGradient id={id("patty")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8A5237" />
          <stop offset="100%" stopColor="#4C2A1B" />
        </linearGradient>
        <linearGradient id={id("cheese")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBE27A" />
          <stop offset="100%" stopColor="#E8B93A" />
        </linearGradient>
        <radialGradient id={id("halo")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F0A93A" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#E85C2B" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#E85C2B" stopOpacity="0" />
        </radialGradient>
        <filter id={id("shadow")} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.2" floodColor="#1B1712" floodOpacity="0.38" />
        </filter>
      </defs>

      {glow && <circle cx="60" cy="58" r="58" fill={`url(#${id("halo")})`} />}

      {/* Sombra de contacto en el piso */}
      <ellipse cx="60" cy="112" rx="34" ry="6" fill="#1B1712" opacity="0.18" />

      <g filter={`url(#${id("shadow")})`}>
        {/* Pan inferior */}
        <path d="M14 80 Q14 100 60 100 Q106 100 106 80 L106 72 L14 72 Z" fill={`url(#${id("bunBottom")})`} />
        <path d="M16 82 Q16 96 60 96 Q104 96 104 82" fill="none" stroke="#FFD98A" strokeWidth="1.6" opacity="0.35" />

        {/* Carne */}
        <path d="M12 72 Q12 62 60 62 Q108 62 108 72 Q108 78 60 78 Q12 78 12 72 Z" fill={`url(#${id("patty")})`} />

        {/* Queso derretido asomando */}
        <path
          d="M14 66 L106 66 L100 74 L92 68 L82 76 L72 68 L60 76 L48 68 L38 76 L28 68 L20 74 Z"
          fill={`url(#${id("cheese")})`}
          opacity="0.95"
        />

        {/* Lechuga bajo el pan superior */}
        <path
          d="M14 64 Q24 56 34 63 Q44 55 54 63 Q64 55 74 63 Q84 55 94 63 Q102 57 108 64 Q60 70 14 64 Z"
          fill="#8FAE68"
        />

        {/* Sésamo del pan superior, detrás de la cabeza (queda fijo aunque la cabeza flote) */}
        <g opacity="0.9">
          <ellipse cx="42" cy="26" rx="2.4" ry="1.7" fill="#FFF7E8" transform="rotate(-18 42 26)" />
          <ellipse cx="60" cy="20" rx="2.4" ry="1.7" fill="#FFF7E8" />
          <ellipse cx="78" cy="27" rx="2.4" ry="1.7" fill="#FFF7E8" transform="rotate(16 78 27)" />
        </g>

        {/* Cabeza (pan superior + cara) */}
        <motion.g
          animate={animate ? { y: [0, -2.5, 0] } : undefined}
          transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M14 62 Q10 16 60 12 Q110 16 106 62 Q106 72 60 72 Q14 72 14 62 Z" fill={`url(#${id("bunTop")})`} />

          {/* Luz de borde superior: separa a Mordi del fondo oscuro de los tableros */}
          <path
            d="M18 50 Q18 22 60 18 Q88 20 98 38"
            fill="none"
            stroke="#FFF0C4"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.5"
          />
          {/* Oclusión donde el pan se apoya en la lechuga */}
          <path d="M16 66 Q60 74 104 66 Q60 72 16 66 Z" fill="#8F5615" opacity="0.35" />

          {/* Sésamo delantero */}
          <g opacity="0.95">
            <ellipse cx="50" cy="34" rx="2" ry="1.4" fill="#FFF7E8" transform="rotate(-12 50 34)" />
            <ellipse cx="70" cy="35" rx="2" ry="1.4" fill="#FFF7E8" transform="rotate(14 70 35)" />
            <ellipse cx="30" cy="46" rx="1.8" ry="1.3" fill="#FFF7E8" opacity="0.75" transform="rotate(-24 30 46)" />
            <ellipse cx="90" cy="47" rx="1.8" ry="1.3" fill="#FFF7E8" opacity="0.75" transform="rotate(22 90 47)" />
          </g>

          {/* Mejillas */}
          <ellipse cx="33" cy="53" rx="7" ry="5" fill="#E85C2B" opacity="0.3" />
          <ellipse cx="87" cy="53" rx="7" ry="5" fill="#E85C2B" opacity="0.3" />

          <MordiFace expression={expression} />
        </motion.g>
      </g>
    </svg>
  );
}

/** Ojos redondos con brillo — base compartida por casi todas las expresiones */
function RoundEyes({ r = 5.2, y = 45 }: { r?: number; y?: number }) {
  return (
    <g>
      <circle cx="44" cy={y} r={r} fill="#1B1712" />
      <circle cx="76" cy={y} r={r} fill="#1B1712" />
      <circle cx={44 + r * 0.35} cy={y - r * 0.4} r={r * 0.32} fill="#FBF6EE" />
      <circle cx={76 + r * 0.35} cy={y - r * 0.4} r={r * 0.32} fill="#FBF6EE" />
    </g>
  );
}

function MordiFace({ expression }: { expression: MordiExpression }) {
  if (expression === "surprised") {
    return (
      <g>
        <RoundEyes r={6.4} y={44} />
        <ellipse cx="60" cy="59" rx="7" ry="9" fill="#1B1712" />
        <ellipse cx="60" cy="62" rx="4" ry="4.5" fill="#C7451D" opacity="0.8" />
      </g>
    );
  }

  if (expression === "wink") {
    return (
      <g>
        {/* Ojo izquierdo guiñado (arco), derecho abierto */}
        <path d="M37 46 Q44 39 51 46" stroke="#1B1712" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="76" cy="45" r="5.2" fill="#1B1712" />
        <circle cx="77.8" cy="42.9" r="1.7" fill="#FBF6EE" />
        <path d="M47 58 Q60 69 73 58" stroke="#1B1712" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M50 59 Q60 66 70 59 Q60 63 50 59 Z" fill="#C7451D" opacity="0.7" />
      </g>
    );
  }

  if (expression === "dizzy") {
    return (
      <g>
        <path d="M39 40 L49 48 M49 40 L39 48" stroke="#1B1712" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M71 40 L81 48 M81 40 L71 48" stroke="#1B1712" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M48 62 Q60 54 72 62" stroke="#1B1712" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  if (expression === "determined") {
    return (
      <g>
        <RoundEyes r={4.6} y={46} />
        {/* Cejas fruncidas */}
        <path d="M36 38 L51 42" stroke="#1B1712" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M84 38 L69 42" stroke="#1B1712" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M50 60 L70 60" stroke="#1B1712" strokeWidth="4.2" strokeLinecap="round" />
      </g>
    );
  }

  if (expression === "cool") {
    return (
      <g>
        {/* Lentes de sol */}
        <path d="M30 42 L90 42" stroke="#1B1712" strokeWidth="3" strokeLinecap="round" />
        <rect x="33" y="41" width="22" height="14" rx="6" fill="#1B1712" />
        <rect x="65" y="41" width="22" height="14" rx="6" fill="#1B1712" />
        <path d="M55 46 L65 46" stroke="#1B1712" strokeWidth="3" />
        <path d="M36 44 L42 44" stroke="#FBF6EE" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
        <path d="M68 44 L74 44" stroke="#FBF6EE" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
        <path d="M49 62 Q60 70 71 62" stroke="#1B1712" strokeWidth="4.2" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  if (expression === "love") {
    return (
      <g>
        <path
          d="M44 40 C40 35 33 37 33 43 C33 48 40 52 44 55 C48 52 55 48 55 43 C55 37 48 35 44 40 Z"
          fill="#E85C2B"
        />
        <path
          d="M76 40 C72 35 65 37 65 43 C65 48 72 52 76 55 C80 52 87 48 87 43 C87 37 80 35 76 40 Z"
          fill="#E85C2B"
        />
        <path d="M48 60 Q60 70 72 60" stroke="#1B1712" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  if (expression === "sad") {
    return (
      <g>
        <RoundEyes r={5} y={46} />
        <path d="M36 40 Q44 36 51 39" stroke="#1B1712" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M84 40 Q76 36 69 39" stroke="#1B1712" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M50 63 Q60 56 70 63" stroke="#1B1712" strokeWidth="4.2" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  // happy (default)
  return (
    <g>
      <RoundEyes r={5.2} y={45} />
      <path d="M46 58 Q60 70 74 58" stroke="#1B1712" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M50 60 Q60 67 70 60 Q60 64 50 60 Z" fill="#C7451D" opacity="0.7" />
    </g>
  );
}
