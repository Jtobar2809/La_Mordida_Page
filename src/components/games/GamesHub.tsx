"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GameSlug } from "@/lib/games";

// Lazy-load heavy game components to keep first-load bundle small
const Loader = () => (
  <div className="mx-auto flex max-w-4xl items-center justify-center gap-3 py-16 text-sm text-charcoal-400">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ember-500 border-t-transparent" />
    Cargando juego…
  </div>
);
const AtrapaLaMordida = dynamic(() => import("./AtrapaLaMordida").then((m) => m.AtrapaLaMordida), {
  ssr: false,
  loading: Loader,
});
const ReaccionRapida = dynamic(() => import("./ReaccionRapida").then((m) => m.ReaccionRapida), {
  ssr: false,
  loading: Loader,
});
const MordiRunner = dynamic(() => import("./MordiRunner").then((m) => m.MordiRunner), {
  ssr: false,
  loading: Loader,
});
const TorreDeIngredientes = dynamic(() => import("./TorreDeIngredientes").then((m) => m.TorreDeIngredientes), {
  ssr: false,
  loading: Loader,
});
const ComboPerfecto = dynamic(() => import("./ComboPerfecto").then((m) => m.ComboPerfecto), {
  ssr: false,
  loading: Loader,
});
const MemoramaDeSabores = dynamic(() => import("./MemoramaDeSabores").then((m) => m.MemoramaDeSabores), {
  ssr: false,
  loading: Loader,
});
const SaltaLaParrilla = dynamic(() => import("./SaltaLaParrilla").then((m) => m.SaltaLaParrilla), {
  ssr: false,
  loading: Loader,
});
const CortaLosIngredientes = dynamic(() => import("./CortaLosIngredientes").then((m) => m.CortaLosIngredientes), {
  ssr: false,
  loading: Loader,
});

/**
 * Catálogo de minijuegos disponibles. Cada entrada nueva que se
 * construya se agrega aquí — el selector y el layout se generan solos.
 * `component: null` significa "todavía no construido" (aparece en la
 * lista como próximamente, sin romper nada).
 */
const GAMES: { slug: GameSlug; label: string; emoji: string; component: React.ComponentType | null }[] = [
  { slug: "atrapa-la-mordida", label: "Atrapa la Mordida", emoji: "🎯", component: AtrapaLaMordida },
  { slug: "reaccion-rapida", label: "Reacción Rápida", emoji: "⚡", component: ReaccionRapida },
  { slug: "mordi-runner", label: "Mordi Runner", emoji: "🏃", component: MordiRunner },
  { slug: "torre-de-ingredientes", label: "Torre de Ingredientes", emoji: "🍔", component: TorreDeIngredientes },
  { slug: "combo-perfecto", label: "Combo Perfecto", emoji: "🔢", component: ComboPerfecto },
  { slug: "memorama-de-sabores", label: "Memorama de Sabores", emoji: "🃏", component: MemoramaDeSabores },
  { slug: "salta-la-parrilla", label: "Salta la Parrilla", emoji: "🔥", component: SaltaLaParrilla },
  { slug: "corta-los-ingredientes", label: "Corta los Ingredientes", emoji: "🔪", component: CortaLosIngredientes },
  { slug: "encesta-la-papa", label: "Encesta la Papa", emoji: "🍟", component: null },
  { slug: "ruleta-de-la-suerte", label: "Ruleta de la Suerte", emoji: "🎡", component: null },
];

/**
 * Hub de minijuegos: selector horizontal + el juego activo debajo.
 * Todos los juegos son siempre jugables (no hay toggle de admin) —
 * son puramente recreativos, pensados para diversión y engagement de
 * comunidad vía tabla de posiciones.
 *
 * El indicador del juego activo es un único elemento compartido con
 * `layoutId`: Framer lo interpola de una pastilla a otra, así que el
 * selector se lee como un control físico y no como diez botones que
 * cambian de color.
 */
export function GamesHub() {
  const [active, setActive] = React.useState<GameSlug>("atrapa-la-mordida");
  const activeGame = GAMES.find((g) => g.slug === active)!;
  const ActiveComponent = activeGame.component;
  const available = GAMES.filter((g) => g.component).length;

  return (
    <div>
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-charcoal-400">Elige tu juego</p>
          <p className="text-[11px] font-semibold text-charcoal-400">
            {available} disponibles · {GAMES.length - available} próximamente
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {GAMES.map((game) => {
            const isActive = active === game.slug;
            const locked = !game.component;
            return (
              <button
                key={game.slug}
                onClick={() => game.component && setActive(game.slug)}
                disabled={locked}
                aria-pressed={isActive}
                className={cn(
                  "group relative flex items-center gap-2 overflow-hidden rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "border-transparent text-white shadow-glow"
                    : "border-charcoal-200 bg-white text-charcoal-600 hover:-translate-y-0.5 hover:border-ember-300 hover:text-ember-600 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-200 dark:hover:border-ember-500",
                  locked && "cursor-not-allowed opacity-45 hover:translate-y-0"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="lm-game-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 -z-10 rounded-full bg-ember-gradient"
                  />
                )}
                <span className={cn("text-base leading-none", locked && "grayscale")}>{game.emoji}</span>
                <span className="whitespace-nowrap">{game.label}</span>
                {locked && <Lock className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      <motion.div
        key={active}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-10"
      >
        {ActiveComponent && <ActiveComponent />}
      </motion.div>
    </div>
  );
}
