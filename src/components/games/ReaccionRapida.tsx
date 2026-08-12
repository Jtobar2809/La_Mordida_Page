"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gauge, Hourglass, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/games/Leaderboard";
import { MordiSprite, type MordiExpression } from "@/components/games/MordiSprite";
import { GameLayout, GameResult, GameShell, GameStat } from "@/components/games/GameShell";
import { useScoreSubmit } from "@/components/games/useScoreSubmit";
import { chanceFor, ramp } from "@/components/games/difficulty";
import { cn } from "@/lib/utils";

const GAME_SLUG = "reaccion-rapida";
const BEST_SCORE_KEY = "lm_game_best_reaccion-rapida";

const ROUNDS = 5;
const TOO_SOON_PENALTY_MS = 1000; // tiempo "castigo" si el usuario toca antes de tiempo

// ── Dificultad progresiva ──
// Ronda a ronda la espera se vuelve más larga e impredecible (cuesta más
// mantener la tensión) y aparecen "amagos": destellos breves que imitan
// la señal de salida. Tocar durante un amago cuenta como salida en falso,
// así que las últimas rondas exigen distinguir la señal real, no solo ser
// rápido.
const WAIT_MIN_FROM = 1200;
const WAIT_MIN_TO = 900;
const WAIT_MAX_FROM = 3000;
const WAIT_MAX_TO = 4400;
const FEINT_STARTS_AT_ROUND = 1; // índice de ronda (0 = primera): la primera va limpia
const FEINT_MAX_CHANCE = 0.85;
const FEINT_FLASH_MS = 140;

// El leaderboard ordena de mayor a menor score, pero en este juego
// "mejor" significa un tiempo de reacción MENOR (en ms). Para reusar el
// mismo leaderboard genérico sin tocar su lógica de ordenamiento,
// invertimos la métrica: score = SCORE_BASE - promedioMs (recortado a
// 0). Así, reaccionar más rápido siempre produce un score más alto.
const SCORE_BASE = 5000;

type Phase = "idle" | "waiting" | "ready" | "tooSoon" | "roundResult" | "finished";

/** Etiqueta cualitativa del tiempo de reacción, para dar contexto al número */
function rating(ms: number): { label: string; className: string } {
  if (ms >= TOO_SOON_PENALTY_MS) return { label: "Muy pronto", className: "text-red-400" };
  if (ms < 180) return { label: "¡Relámpago!", className: "text-mustard-400" };
  if (ms < 250) return { label: "Excelente", className: "text-mustard-300" };
  if (ms < 330) return { label: "Muy bien", className: "text-emerald-400" };
  if (ms < 450) return { label: "Bien", className: "text-ember-300" };
  return { label: "A calentar la parrilla", className: "text-charcoal-300" };
}

/**
 * Minijuego "Reacción Rápida": mide el tiempo de reacción del usuario
 * en 5 rondas. Cada ronda espera un intervalo aleatorio con la parrilla
 * "fría" (espera), luego se enciende (¡YA!) — el usuario debe tocar lo
 * más rápido posible. Tocar antes de tiempo penaliza la ronda.
 * El más simple y liviano de construir: solo timers + estado, sin
 * ninguna dependencia de gestos complejos ni física.
 */
export function ReaccionRapida() {
  const { submit, leaderboardKey, savedAs } = useScoreSubmit(GAME_SLUG);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [round, setRound] = React.useState(0);
  const [times, setTimes] = React.useState<number[]>([]);
  const [lastTime, setLastTime] = React.useState<number | null>(null);
  const [feint, setFeint] = React.useState(false); // amago en curso
  const [bestAvg, setBestAvg] = React.useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = React.useState(false);

  const waitTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const feintTimeouts = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const readyAt = React.useRef<number>(0);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestAvg(Number(stored) || null);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  const clearFeints = React.useCallback(() => {
    feintTimeouts.current.forEach(clearTimeout);
    feintTimeouts.current = [];
  }, []);

  React.useEffect(() => {
    return () => {
      if (waitTimeout.current) clearTimeout(waitTimeout.current);
      feintTimeouts.current.forEach(clearTimeout);
    };
  }, []);

  function startGame() {
    setTimes([]);
    setRound(0);
    setLastTime(null);
    setIsNewRecord(false);
    startRound(0);
  }

  /**
   * Arranca una ronda. Recibe el índice explícitamente porque se llama
   * justo después de `setRound`, cuando el estado todavía no se actualizó.
   */
  function startRound(index: number) {
    clearFeints();
    setFeint(false);
    setPhase("waiting");

    const minWait = ramp(index, WAIT_MIN_FROM, WAIT_MIN_TO, ROUNDS - 1);
    const maxWait = ramp(index, WAIT_MAX_FROM, WAIT_MAX_TO, ROUNDS - 1);
    const wait = minWait + Math.random() * (maxWait - minWait);

    // Amagos: destellos que imitan la señal real, con probabilidad y
    // cantidad crecientes. Se programan solo dentro de la ventana segura
    // (ni al inicio ni pegados al "¡YA!", para que no se confundan con él).
    const feintChance = chanceFor(index, FEINT_STARTS_AT_ROUND, FEINT_MAX_CHANCE, ROUNDS - 2);
    const feintCount = Math.random() < feintChance ? (index >= 3 ? 2 : 1) : 0;
    const feintWindow = Math.max(0, wait - 1100);
    for (let i = 0; i < feintCount; i++) {
      const at = 450 + Math.random() * feintWindow;
      feintTimeouts.current.push(
        setTimeout(() => {
          setFeint(true);
          feintTimeouts.current.push(setTimeout(() => setFeint(false), FEINT_FLASH_MS));
        }, at)
      );
    }

    waitTimeout.current = setTimeout(() => {
      clearFeints();
      setFeint(false);
      readyAt.current = performance.now();
      setPhase("ready");
    }, wait);
  }

  function handleZoneClick() {
    if (phase === "waiting") {
      // tocó antes de tiempo (o picó el amago)
      if (waitTimeout.current) clearTimeout(waitTimeout.current);
      clearFeints();
      setFeint(false);
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
      setPhase("finished");
      return;
    }
    setRound(nextIndex);
    startRound(nextIndex);
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

    submit(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const inRound = phase !== "idle" && phase !== "finished";
  const mordiMood: MordiExpression =
    phase === "ready"
      ? "surprised"
      : phase === "tooSoon"
        ? "dizzy"
        : phase === "waiting"
          ? "determined"
          : phase === "finished"
            ? isNewRecord
              ? "love"
              : "wink"
            : "happy";

  return (
    <GameLayout>
      <GameShell
        title="REACCIÓN RÁPIDA"
        subtitle={`Espera a que la parrilla se encienda y toca al instante. ${ROUNDS} rondas, gana el mejor promedio.`}
        mordi={mordiMood}
        bareBoard
        hud={
          <>
            <GameStat
              icon={<Hourglass className="h-4 w-4" />}
              label="Ronda"
              value={`${Math.min(round + 1, ROUNDS)}/${ROUNDS}`}
            />
            <GameStat
              icon={<TrendingUp className="h-4 w-4" />}
              label="Nivel"
              value={round + 1}
              tone={round >= FEINT_STARTS_AT_ROUND ? "ember" : "neutral"}
            />
            {lastTime !== null && (
              <GameStat
                icon={<Zap className="h-4 w-4" />}
                label="Último"
                value={lastTime >= TOO_SOON_PENALTY_MS ? "—" : `${lastTime} ms`}
                tone={lastTime < 250 ? "gold" : "neutral"}
              />
            )}
            {avgMs !== null && (
              <GameStat icon={<Gauge className="h-4 w-4" />} label="Promedio" value={`${avgMs} ms`} tone="ember" />
            )}
          </>
        }
        footer={
          <div className="space-y-4">
            {/* Marcador por ronda: una brasa por cada intento */}
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: ROUNDS }).map((_, i) => {
                const t = times[i];
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "h-2.5 w-8 rounded-full transition-colors",
                        t === undefined
                          ? "bg-charcoal-200 dark:bg-charcoal-700"
                          : t >= TOO_SOON_PENALTY_MS
                            ? "bg-red-500"
                            : t < 250
                              ? "bg-mustard-400"
                              : "bg-ember-500"
                      )}
                    />
                    <span className="font-mono text-[10px] text-charcoal-400">
                      {t === undefined ? "–" : t >= TOO_SOON_PENALTY_MS ? "✕" : t}
                    </span>
                  </div>
                );
              })}
            </div>

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
              <GameResult
                isNewRecord={isNewRecord}
                headline={`${avgMs} ms de promedio`}
                detail={rating(avgMs).label}
                bestLabel={bestAvg !== null ? `Tu récord personal: ${bestAvg} ms` : undefined}
                savedAs={savedAs}
                onReplay={startGame}
              />
            )}
          </div>
        }
      >
        <button
          type="button"
          onClick={handleZoneClick}
          disabled={!inRound || phase === "roundResult"}
          className={cn(
            "relative flex h-64 w-full items-center justify-center overflow-hidden rounded-2xl transition-colors duration-150 disabled:cursor-default sm:h-72"
          )}
          style={{
            background:
              phase === "ready"
                ? "radial-gradient(90% 90% at 50% 45%, #34D399 0%, #059669 55%, #04543C 100%)"
                : phase === "waiting"
                  ? // El amago imita el verde de salida por un instante: es la
                    // trampa, así que tiene que ser creíble a primera vista.
                    feint
                    ? "radial-gradient(90% 90% at 50% 45%, #2FBE8B 0%, #0A7A56 55%, #063D2C 100%)"
                    : "radial-gradient(90% 90% at 50% 100%, #7C2C19 0%, #3A1A10 60%, #180D07 100%)"
                  : phase === "tooSoon"
                    ? "radial-gradient(90% 90% at 50% 50%, #4a1414 0%, #1c0b0b 70%)"
                    : "radial-gradient(120% 90% at 50% 0%, #3A2519 0%, #241711 45%, #140D08 100%)",
          }}
        >
          {/* Rejilla de la parrilla — se enciende con la fase */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0 3px, transparent 3px 26px)",
            }}
          />
          {phase === "waiting" && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
              animate={{ opacity: [0.35, 0.65, 0.35] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "radial-gradient(70% 100% at 50% 100%, rgba(232,92,43,0.7) 0%, rgba(232,92,43,0) 70%)" }}
            />
          )}
          {phase === "ready" && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0.9, scale: 0.6 }}
              animate={{ opacity: 0, scale: 1.6 }}
              transition={{ duration: 0.5 }}
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 60%)" }}
            />
          )}

          <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
            <AnimatePresence mode="wait">
              {phase === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="h-16 w-16">
                    <MordiSprite expression="happy" glow className="h-full w-full" />
                  </div>
                  <p className="font-display text-lg tracking-wide text-cream">Presiona &quot;Jugar&quot; para empezar</p>
                </motion.div>
              )}

              {phase === "waiting" && (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <motion.div
                    className="h-16 w-16"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <MordiSprite expression="determined" animate={false} className="h-full w-full" />
                  </motion.div>
                  <p className="font-display text-2xl tracking-[0.2em] text-charcoal-200">ESPERA…</p>
                </motion.div>
              )}

              {phase === "ready" && (
                <motion.div
                  key="ready"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14, ease: "backOut" }}
                  className="flex flex-col items-center gap-2"
                >
                  <Zap className="h-12 w-12 text-white drop-shadow" />
                  <p className="font-display text-5xl tracking-wide text-white drop-shadow-lg">¡YA!</p>
                </motion.div>
              )}

              {phase === "tooSoon" && (
                <motion.div
                  key="tooSoon"
                  initial={{ x: 0 }}
                  animate={{ x: [0, -10, 10, -6, 6, 0] }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="h-16 w-16">
                    <MordiSprite expression="dizzy" animate={false} className="h-full w-full" />
                  </div>
                  <p className="font-display text-xl tracking-wide text-red-300">¡Muy pronto!</p>
                  <p className="text-xs text-charcoal-200">Toca de nuevo para continuar</p>
                </motion.div>
              )}

              {phase === "roundResult" && lastTime !== null && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="flex flex-col items-center gap-1"
                >
                  <p className="font-display text-5xl tracking-wide text-cream">
                    {lastTime >= TOO_SOON_PENALTY_MS ? "✕" : lastTime}
                    {lastTime < TOO_SOON_PENALTY_MS && <span className="ml-1 text-2xl text-charcoal-300">ms</span>}
                  </p>
                  <p className={cn("font-display text-sm uppercase tracking-[0.2em]", rating(lastTime).className)}>
                    {rating(lastTime).label}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </button>
      </GameShell>

      <Leaderboard
        game={GAME_SLUG}
        refreshKey={leaderboardKey}
        formatScore={(s) => `${Math.max(0, SCORE_BASE - s)} ms`}
      />
    </GameLayout>
  );
}
