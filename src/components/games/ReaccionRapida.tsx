"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leaderboard } from "@/components/games/Leaderboard";
import { submitGameScoreAction } from "@/actions/games";
import { cn } from "@/lib/utils";

const GAME_SLUG = "reaccion-rapida";
const BEST_SCORE_KEY = "lm_game_best_reaccion-rapida";

const ROUNDS = 5;
const MIN_WAIT_MS = 1200;
const MAX_WAIT_MS = 3200;
const TOO_SOON_PENALTY_MS = 1000; // tiempo "castigo" si el usuario toca antes de tiempo

// El leaderboard ordena de mayor a menor score, pero en este juego
// "mejor" significa un tiempo de reacción MENOR (en ms). Para reusar el
// mismo leaderboard genérico sin tocar su lógica de ordenamiento,
// invertimos la métrica: score = SCORE_BASE - promedioMs (recortado a
// 0). Así, reaccionar más rápido siempre produce un score más alto.
const SCORE_BASE = 5000;

type Phase = "idle" | "waiting" | "ready" | "tooSoon" | "roundResult" | "finished";

/**
 * Minijuego "Reacción Rápida": mide el tiempo de reacción del usuario
 * en 5 rondas. Cada ronda espera un intervalo aleatorio en pantalla
 * "roja" (espera), luego cambia a "verde" (¡YA!) — el usuario debe
 * tocar lo más rápido posible. Tocar antes de tiempo penaliza la ronda.
 * El más simple y liviano de construir: solo timers + estado, sin
 * ninguna dependencia de gestos complejos ni física.
 */
export function ReaccionRapida() {
  const { data: session } = useSession();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [round, setRound] = React.useState(0);
  const [times, setTimes] = React.useState<number[]>([]);
  const [lastTime, setLastTime] = React.useState<number | null>(null);
  const [bestAvg, setBestAvg] = React.useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);

  const waitTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyAt = React.useRef<number>(0);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestAvg(Number(stored) || null);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (waitTimeout.current) clearTimeout(waitTimeout.current);
    };
  }, []);

  function startGame() {
    setTimes([]);
    setRound(0);
    setIsNewRecord(false);
    startRound();
  }

  function startRound() {
    setPhase("waiting");
    const wait = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS);
    waitTimeout.current = setTimeout(() => {
      readyAt.current = performance.now();
      setPhase("ready");
    }, wait);
  }

  function handleZoneClick() {
    if (phase === "waiting") {
      // tocó antes de tiempo
      if (waitTimeout.current) clearTimeout(waitTimeout.current);
      setPhase("tooSoon");
      return;
    }

    if (phase === "ready") {
      const reactionMs = Math.round(performance.now() - readyAt.current);
      setLastTime(reactionMs);
      setTimes((t) => [...t, reactionMs]);
      setPhase("roundResult");
      return;
    }

    if (phase === "tooSoon") {
      setLastTime(TOO_SOON_PENALTY_MS);
      setTimes((t) => [...t, TOO_SOON_PENALTY_MS]);
      setPhase("roundResult");
      return;
    }
  }

  function nextRound() {
    const nextIndex = round + 1;
    if (nextIndex >= ROUNDS) {
      finishGame();
      return;
    }
    setRound(nextIndex);
    startRound();
  }

  function finishGame() {
    setPhase("finished");
  }

  const avgMs = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const score = avgMs !== null ? Math.max(0, SCORE_BASE - avgMs) : 0;

  React.useEffect(() => {
    if (phase !== "finished" || avgMs === null) return;

    const isBetter = bestAvg === null || avgMs < bestAvg;
    if (isBetter) {
      setBestAvg(avgMs);
      setIsNewRecord(true);
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(avgMs));
      } catch {
        // sin persistencia local, no es crítico
      }
    }

    if (session?.user) {
      submitGameScoreAction({ game: GAME_SLUG, score }).then((result) => {
        if (result.success) {
          setLeaderboardKey((k) => k + 1);
        } else {
          toast.error(result.error);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <Card className="p-6 text-center">
        <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">REACCIÓN RÁPIDA</h3>
        <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
          Espera el verde y toca lo más rápido posible. {ROUNDS} rondas, mide tu promedio.
        </p>

        {phase !== "idle" && phase !== "finished" && (
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
            Ronda {round + 1} / {ROUNDS}
          </p>
        )}

        <button
          type="button"
          onClick={handleZoneClick}
          disabled={phase === "idle" || phase === "roundResult" || phase === "finished"}
          className={cn(
            "relative mt-4 flex h-64 w-full items-center justify-center overflow-hidden rounded-2xl text-2xl font-display tracking-wide text-white transition-colors duration-150",
            (phase === "idle" || phase === "finished") && "bg-charcoal-100 text-charcoal-400 dark:bg-charcoal-800",
            phase === "waiting" && "bg-red-500",
            phase === "ready" && "bg-emerald-500",
            phase === "tooSoon" && "bg-charcoal-700",
            phase === "roundResult" && "bg-charcoal-100 dark:bg-charcoal-800"
          )}
        >
          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Presiona &quot;Jugar&quot; para empezar
              </motion.span>
            )}
            {phase === "waiting" && (
              <motion.span key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                Espera…
              </motion.span>
            )}
            {phase === "ready" && (
              <motion.span
                key="ready"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.15, ease: "backOut" }}
                className="flex items-center gap-2"
              >
                <Zap className="h-8 w-8" /> ¡YA!
              </motion.span>
            )}
            {phase === "tooSoon" && (
              <motion.span
                key="tooSoon"
                initial={{ x: 0 }}
                animate={{ x: [0, -8, 8, -6, 6, 0] }}
                transition={{ duration: 0.4 }}
                className="text-lg text-cream"
              >
                Muy pronto — toca de nuevo para continuar
              </motion.span>
            )}
            {phase === "roundResult" && lastTime !== null && (
              <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="font-display text-3xl text-charcoal-900 dark:text-cream">
                  {lastTime === TOO_SOON_PENALTY_MS ? "Muy pronto" : `${lastTime} ms`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        <div className="mt-6">
          {phase === "idle" && (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )}

          {phase === "roundResult" && (
            <Button onClick={nextRound} size="lg" className="w-full">
              {round + 1 >= ROUNDS ? "Ver resultado" : "Siguiente ronda"}
            </Button>
          )}

          {phase === "finished" && avgMs !== null && (
            <div className="space-y-3">
              <AnimatePresence mode="wait">
                {isNewRecord ? (
                  <motion.div
                    key="record"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mustard-400/15 px-3 py-1 text-xs font-bold text-mustard-500">
                      <Sparkles className="h-3.5 w-3.5" /> ¡NUEVO RÉCORD!
                    </span>
                    <p className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">
                      {avgMs} ms promedio
                    </p>
                  </motion.div>
                ) : (
                  <motion.p
                    key="normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream"
                  >
                    Tu promedio: {avgMs} ms
                  </motion.p>
                )}
              </AnimatePresence>

              {!isNewRecord && bestAvg !== null && (
                <p className="text-xs text-charcoal-400">Tu récord personal: {bestAvg} ms</p>
              )}
              {!session?.user && (
                <p className="text-xs text-charcoal-400">Inicia sesión para aparecer en la tabla de posiciones.</p>
              )}

              <Button onClick={startGame} size="lg" className="w-full">
                Jugar de nuevo
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Leaderboard
        game={GAME_SLUG}
        refreshKey={leaderboardKey}
        formatScore={(s) => `${Math.max(0, SCORE_BASE - s)} ms`}
      />
    </div>
  );
}
