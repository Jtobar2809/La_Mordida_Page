"use client";

import { motion } from "framer-motion";

export type MordiExpression = "happy" | "surprised" | "wink" | "dizzy";

interface MordiSpriteProps {
  className?: string;
  expression?: MordiExpression;
  animate?: boolean;
}

/**
 * Ilustración vectorial de Mordi (SVG inline), usada como personaje en
 * los minijuegos. Se construyó en SVG en vez de depender del PNG
 * (/MordiSinFondo.png) porque dentro de contenedores con transforms 3D
 * complejos (flip de cartas, motion.div anidados con rotateY/scale),
 * next/image con `fill` puede fallar a resolver su tamaño en el primer
 * paint y quedar invisible. Un SVG inline no depende de una petición de
 * red ni de que el layout del contenedor ya esté asentado — siempre se
 * pinta. Además, permite variar la expresión de la cara por contexto de
 * juego (sorprendido al aparecer, guiño al ganar, mareado al perder).
 */
export function MordiSprite({ className, expression = "happy", animate = true }: MordiSpriteProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mordi-bun-top" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#F5BE5C" />
          <stop offset="100%" stopColor="#E28E1B" />
        </radialGradient>
        <linearGradient id="mordi-bun-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D9A15C" />
          <stop offset="100%" stopColor="#BB7015" />
        </linearGradient>
        <filter id="mordi-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1B1712" floodOpacity="0.35" />
        </filter>
      </defs>

      <g filter="url(#mordi-shadow)">
        {/* Pan inferior */}
        <path d="M14 78 Q14 96 60 96 Q106 96 106 78 L106 70 L14 70 Z" fill="url(#mordi-bun-bottom)" />
        {/* Sésamo del pan superior, detrás de la cabeza */}
        <circle cx="42" cy="26" r="2" fill="#FBF6EE" opacity="0.85" />
        <circle cx="60" cy="20" r="2" fill="#FBF6EE" opacity="0.85" />
        <circle cx="78" cy="27" r="2" fill="#FBF6EE" opacity="0.85" />
        <circle cx="50" cy="34" r="1.6" fill="#FBF6EE" opacity="0.7" />
        <circle cx="70" cy="35" r="1.6" fill="#FBF6EE" opacity="0.7" />

        {/* Cabeza (pan superior + cara) */}
        <motion.g
          animate={animate ? { y: [0, -2, 0] } : undefined}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M14 62 Q10 18 60 14 Q110 18 106 62 Q106 72 60 72 Q14 72 14 62 Z"
            fill="url(#mordi-bun-top)"
          />
          <path
            d="M14 62 Q10 18 60 14 Q110 18 106 62"
            fill="none"
            stroke="#C7451D"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.25"
          />

          {/* Mejillas */}
          <circle cx="34" cy="52" r="6" fill="#E85C2B" opacity="0.35" />
          <circle cx="86" cy="52" r="6" fill="#E85C2B" opacity="0.35" />

          {/* Cara según expresión */}
          <MordiFace expression={expression} />
        </motion.g>
      </g>
    </svg>
  );
}

function MordiFace({ expression }: { expression: MordiExpression }) {
  if (expression === "surprised") {
    return (
      <g>
        <circle cx="44" cy="44" r="6" fill="#1B1712" />
        <circle cx="76" cy="44" r="6" fill="#1B1712" />
        <circle cx="46" cy="42" r="1.8" fill="#FBF6EE" />
        <circle cx="78" cy="42" r="1.8" fill="#FBF6EE" />
        <ellipse cx="60" cy="58" rx="7" ry="9" fill="#1B1712" />
      </g>
    );
  }

  if (expression === "wink") {
    return (
      <g>
        <path d="M38 44 Q44 38 50 44" stroke="#1B1712" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="76" cy="44" r="5" fill="#1B1712" />
        <circle cx="78" cy="42" r="1.6" fill="#FBF6EE" />
        <path d="M48 58 Q60 68 72 58" stroke="#1B1712" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  if (expression === "dizzy") {
    return (
      <g>
        <path d="M39 40 L49 48 M49 40 L39 48" stroke="#1B1712" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M71 40 L81 48 M81 40 L71 48" stroke="#1B1712" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M48 60 Q60 54 72 60" stroke="#1B1712" strokeWidth="4" strokeLinecap="round" fill="none" />
      </g>
    );
  }

  // happy (default)
  return (
    <g>
      <circle cx="44" cy="45" r="5" fill="#1B1712" />
      <circle cx="76" cy="45" r="5" fill="#1B1712" />
      <circle cx="46" cy="43" r="1.6" fill="#FBF6EE" />
      <circle cx="78" cy="43" r="1.6" fill="#FBF6EE" />
      <path d="M46 58 Q60 70 74 58" stroke="#1B1712" strokeWidth="4.5" strokeLinecap="round" fill="none" />
    </g>
  );
}
