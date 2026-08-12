"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getLeaderboardAction } from "@/actions/games";
import type { GameSlug, LeaderboardPeriod } from "@/lib/games";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "all", label: "Histórico" },
];

// Estilos del podio: los 3 primeros llevan medalla con su propio metal,
// el resto solo el número. Da jerarquía visual sin necesidad de otro layout.
const PODIUM = [
  { medal: "text-mustard-400", row: "bg-mustard-400/10 ring-1 ring-mustard-300/40", ring: "ring-mustard-300" },
  { medal: "text-charcoal-300", row: "bg-charcoal-400/10 ring-1 ring-charcoal-300/30", ring: "ring-charcoal-300" },
  { medal: "text-amber-700", row: "bg-amber-700/10 ring-1 ring-amber-700/30", ring: "ring-amber-700/60" },
];

/**
 * Tabla de posiciones reutilizable para cualquier minijuego. Recibe el
 * slug del juego y consulta el mejor puntaje por jugador en 3 ventanas
 * de tiempo (hoy / semana / histórico).
 *
 * Aparecen todos los jugadores, con o sin cuenta: quien juega sin
 * registrarse compite como "Anónimo #XXXXXX", donde el código lo emite
 * el servidor y es irrepetible. Si el jugador no está en el top visible,
 * se muestra su posición aparte ("Tú vas #N") para darle un motivo
 * concreto para volver a intentarlo.
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

  const playerInTop = data?.top.some((e) => e.playerKey === data.currentPlayerKey);

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
                const isMe = entry.playerKey === data.currentPlayerKey;
                const podium = PODIUM[i];
                return (
                  <motion.li
                    key={entry.playerKey}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors",
                      podium?.row,
                      isMe && "bg-ember-50 ring-1 ring-ember-200 dark:bg-ember-500/10 dark:ring-ember-500/30"
                    )}
                  >
                    <span
                      className={cn(
                        "flex w-6 shrink-0 items-center justify-center font-display text-sm",
                        podium?.medal ?? "text-charcoal-400"
                      )}
                    >
                      {podium ? <Medal className="h-4 w-4 fill-current drop-shadow-sm" /> : i + 1}
                    </span>

                    <div
                      className={cn(
                        "relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-charcoal-100 ring-2 ring-transparent dark:bg-charcoal-700",
                        podium?.ring
                      )}
                    >
                      {entry.image ? (
                        <Image src={entry.image} alt={entry.name} fill className="object-cover" />
                      ) : (
                        <User className="h-4 w-4 text-charcoal-400" />
                      )}
                    </div>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-charcoal-700 dark:text-charcoal-100">
                        {isMe ? "Tú" : entry.name}
                      </span>
                      {entry.isGuest && (
                        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-charcoal-400">
                          {isMe ? entry.name : "invitado"}
                        </span>
                      )}
                    </span>

                    <span className="font-mono text-sm font-bold text-ember-600 dark:text-ember-300">
                      {formatScore(entry.bestScore)}
                    </span>
                  </motion.li>
                );
              })}
            </ul>
          </AnimatePresence>
        )}

        {!loading && data?.playerRank && !playerInTop && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-ember-50 px-3 py-2 ring-1 ring-ember-200 dark:bg-ember-500/10 dark:ring-ember-500/30">
            <span className="w-6 shrink-0 text-center font-display text-sm text-charcoal-400">
              #{data.playerRank.rank}
            </span>
            <span className="flex-1 text-sm font-medium text-charcoal-700 dark:text-charcoal-100">
              Tú{data.isGuest && <span className="ml-1 text-xs text-charcoal-400">(invitado)</span>}
            </span>
            <span className="font-mono text-sm font-bold text-ember-600 dark:text-ember-300">
              {formatScore(data.playerRank.bestScore)}
            </span>
          </div>
        )}

        {!loading && data?.isGuest && (
          <p className="mt-4 text-center text-xs text-charcoal-400">
            Juegas como invitado y ya compites en la tabla. Inicia sesión para aparecer con tu nombre y tu foto.
          </p>
        )}
      </div>
    </Card>
  );
}
