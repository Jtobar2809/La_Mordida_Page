"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { GameSlug } from "@/lib/games";

// Lazy-load heavy game components to keep first-load bundle small
const Loader = () => <div className="py-12 text-center text-sm text-charcoal-400">Cargando juego…</div>;
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
 */
export function GamesHub() {
  const [active, setActive] = React.useState<GameSlug>("atrapa-la-mordida");
  const activeGame = GAMES.find((g) => g.slug === active)!;
  const ActiveComponent = activeGame.component;

  return (
    <div>
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2">
        {GAMES.map((game) => (
          <button
            key={game.slug}
            onClick={() => game.component && setActive(game.slug)}
            disabled={!game.component}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active === game.slug
                ? "border-ember-500 bg-ember-500 text-white"
                : "border-charcoal-200 bg-white text-charcoal-600 hover:border-ember-300 dark:border-charcoal-600 dark:bg-charcoal-800 dark:text-charcoal-200",
              !game.component && "cursor-not-allowed opacity-40"
            )}
          >
            <span>{game.emoji}</span>
            {game.label}
            {!game.component && <span className="text-[10px] uppercase">· pronto</span>}
          </button>
        ))}
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
