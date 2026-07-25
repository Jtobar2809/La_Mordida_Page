"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getLeaderboardAction } from "@/actions/games";
import type { GameSlug, LeaderboardPeriod } from "@/lib/games";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "all", label: "Histórico" },
];

const medalColor = ["text-mustard-400", "text-charcoal-300", "text-amber-700"];

/**
 * Tabla de posiciones reutilizable para cualquier minijuego. Recibe el
 * slug del juego y consulta el mejor puntaje por usuario en 3 ventanas
 * de tiempo (hoy / semana / histórico). Si el usuario tiene sesión pero
 * no está en el top visible, se muestra su posición aparte ("Tú vas
 * #N") para darle un motivo concreto para volver a intentarlo.
 */
export function Leaderboard({
  game,
  refreshKey,
  formatScore = (s) => String(s),
}: {
  game: GameSlug;
  refreshKey?: number;
  /** Formatea el score crudo para mostrar (ej. convertir a "177 ms" en vez del número interno usado para ordenar) */
  formatScore?: (score: number) => string;
}) {
  const [period, setPeriod] = React.useState<LeaderboardPeriod>("today");
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getLeaderboardAction>> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLeaderboardAction(game, period).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // refreshKey fuerza recarga tras registrar un nuevo puntaje
  }, [game, period, refreshKey]);

  const userInTop = data?.top.some((e) => e.userId === data.currentUserId);

  return (
    <Card className="mx-auto max-w-md p-5">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-mustard-400" />
        <h4 className="font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">TABLA DE POSICIONES</h4>
      </div>

      <div className="mb-4 flex gap-1 rounded-full bg-charcoal-50 p-1 dark:bg-charcoal-900/50">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              period === p.value
                ? "bg-white text-charcoal-900 shadow-sm dark:bg-charcoal-700 dark:text-cream"
                : "text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="min-h-[220px]">
        {loading && <p className="py-8 text-center text-sm text-charcoal-400">Cargando…</p>}

        {!loading && data?.top.length === 0 && (
          <p className="py-8 text-center text-sm text-charcoal-400">
            Nadie ha jugado todavía en este periodo. ¡Sé el primero!
          </p>
        )}

        {!loading && data && data.top.length > 0 && (
          <AnimatePresence mode="popLayout">
            <ul className="space-y-1.5">
              {data.top.map((entry, i) => {
                const isMe = entry.userId === data.currentUserId;
                return (
                  <motion.li
                    key={entry.userId}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2",
                      isMe && "bg-ember-50 ring-1 ring-ember-200 dark:bg-ember-500/10 dark:ring-ember-500/30"
                    )}
                  >
                    <span
                      className={cn(
                        "flex w-6 shrink-0 items-center justify-center font-display text-sm",
                        medalColor[i] ?? "text-charcoal-400"
                      )}
                    >
                      {i < 3 ? <Medal className="h-4 w-4 fill-current" /> : i + 1}
                    </span>
                    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-charcoal-100 dark:bg-charcoal-700">
                      {entry.image && <Image src={entry.image} alt="" fill className="object-cover" />}
                    </div>
                    <span className="flex-1 truncate text-sm font-medium text-charcoal-700 dark:text-charcoal-100">
                      {isMe ? "Tú" : entry.name}
                    </span>
                    <span className="font-mono text-sm font-bold text-ember-600">{formatScore(entry.bestScore)}</span>
                  </motion.li>
                );
              })}
            </ul>
          </AnimatePresence>
        )}

        {!loading && data?.userRank && !userInTop && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-ember-50 px-3 py-2 ring-1 ring-ember-200 dark:bg-ember-500/10 dark:ring-ember-500/30">
            <span className="w-6 shrink-0 text-center font-display text-sm text-charcoal-400">
              #{data.userRank.rank}
            </span>
            <span className="flex-1 text-sm font-medium text-charcoal-700 dark:text-charcoal-100">Tú</span>
            <span className="font-mono text-sm font-bold text-ember-600">{formatScore(data.userRank.bestScore)}</span>
          </div>
        )}

        {!loading && !data?.currentUserId && (
          <p className="mt-4 text-center text-xs text-charcoal-400">
            Inicia sesión para aparecer en la tabla de posiciones.
          </p>
        )}
      </div>
    </Card>
  );
}
