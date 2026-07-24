"use client";

import * as React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leaderboard } from "@/components/games/Leaderboard";
import { submitGameScoreAction } from "@/actions/games";
import { cn } from "@/lib/utils";

const GAME_SLUG = "atrapa-la-mordida";
const BEST_SCORE_KEY = "lm_game_best_atrapa-la-mordida";

const GRID_SIZE = 9; // grid 3x3
const GAME_DURATION = 25; // segundos

// Dificultad progresiva: la ventana de aparición se acorta a medida que
// sube el score, dentro de un piso mínimo para que siga siendo jugable.
const BASE_MIN_MS = 650;
const BASE_MAX_MS = 1000;
const MIN_FLOOR_MS = 280;
const MAX_FLOOR_MS = 480;
const DIFFICULTY_STEP = 25; // ms que se recortan por cada acierto

type GameState = "idle" | "playing" | "finished";
type FloatingPlus = { id: number; cell: number };

function randomCell(exclude?: number) {
  let cell = Math.floor(Math.random() * GRID_SIZE);
  if (exclude !== undefined) {
    while (cell === exclude) cell = Math.floor(Math.random() * GRID_SIZE);
  }
  return cell;
}

/** Color de la racha: se intensifica de ember a dorado a medida que crece */
function comboColor(combo: number) {
  if (combo >= 8) return "text-mustard-400";
  if (combo >= 4) return "text-ember-500";
  return "text-charcoal-400";
}

/**
 * Minijuego "Atrapa la Mordida": Mordi aparece en una celda aleatoria de
 * una grilla 3x3 por una ventana de tiempo que se acorta con cada
 * acierto (dificultad progresiva). Puramente recreativo — sin física ni
 * Canvas, solo React state + setTimeout — pero con feedback exagerado
 * (racha con color, "+1" flotante, celebración de récord) para que se
 * sienta satisfactorio y dé ganas de reintentar.
 */
export function AtrapaLaMordida() {
  const { data: session } = useSession();
  const [state, setState] = React.useState<GameState>("idle");
  const [activeCell, setActiveCell] = React.useState<number | null>(null);
  const [score, setScore] = React.useState(0);
  const [combo, setCombo] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(GAME_DURATION);
  const [floatingPlus, setFloatingPlus] = React.useState<FloatingPlus[]>([]);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);

  const appearTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const plusIdCounter = React.useRef(0);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // localStorage no disponible — sin récord persistido, no es crítico
    }
  }, []);

  const scheduleNextAppearance = React.useCallback((currentScore: number, prevCell?: number) => {
    const cell = randomCell(prevCell);
    setActiveCell(cell);

    const reduction = Math.min(currentScore * DIFFICULTY_STEP, BASE_MIN_MS - MIN_FLOOR_MS);
    const minMs = BASE_MIN_MS - reduction;
    const maxMs = Math.max(BASE_MAX_MS - reduction, MAX_FLOOR_MS);
    const visibleFor = minMs + Math.random() * (maxMs - minMs);

    appearTimeout.current = setTimeout(() => {
      setActiveCell((current) => {
        if (current === cell) {
          setCombo(0); // se le escapó: se rompe la racha
          scheduleNextAppearance(currentScore, cell);
        }
        return current === cell ? null : current;
      });
    }, visibleFor);
  }, []);

  function startGame() {
    setScore(0);
    setCombo(0);
    setTimeLeft(GAME_DURATION);
    setIsNewRecord(false);
    setFloatingPlus([]);
    setState("playing");
    scheduleNextAppearance(0);

    countdownInterval.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function endGame() {
    if (appearTimeout.current) clearTimeout(appearTimeout.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setActiveCell(null);
    setState("finished");
  }

  function handleCellClick(index: number) {
    if (state !== "playing" || index !== activeCell) return;

    const nextScore = score + 1;
    setScore(nextScore);
    setCombo((c) => c + 1);
    setActiveCell(null);

    const plusId = plusIdCounter.current++;
    setFloatingPlus((f) => [...f, { id: plusId, cell: index }]);
    setTimeout(() => {
      setFloatingPlus((f) => f.filter((p) => p.id !== plusId));
    }, 600);

    if (appearTimeout.current) clearTimeout(appearTimeout.current);
    scheduleNextAppearance(nextScore, index);
  }

  React.useEffect(() => {
    return () => {
      if (appearTimeout.current) clearTimeout(appearTimeout.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, []);

  // Al terminar: actualiza récord local y registra el puntaje para el leaderboard
  React.useEffect(() => {
    if (state !== "finished") return;

    if (score > bestScore) {
      setBestScore(score);
      setIsNewRecord(true);
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(score));
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
  }, [state]);

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <Card className="p-6 text-center">
        <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">ATRAPA LA MORDIDA</h3>
        <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
          Toca a Mordi antes de que se escape. ¡Se pone más rápido con cada acierto!
        </p>

        <div className="mt-5 flex items-center justify-between text-sm font-semibold text-charcoal-700 dark:text-charcoal-200">
          <span>Puntaje: {score}</span>
          <AnimatePresence mode="wait">
            {combo >= 3 && state === "playing" && (
              <motion.span
                key={combo}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                className={cn("flex items-center gap-1", comboColor(combo))}
              >
                <Sparkles className="h-4 w-4" /> Racha x{combo}
              </motion.span>
            )}
          </AnimatePresence>
          <span>{state === "playing" ? `⏱ ${timeLeft}s` : null}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: GRID_SIZE }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleCellClick(i)}
              disabled={state !== "playing"}
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-charcoal-100 bg-charcoal-50 disabled:cursor-default dark:border-charcoal-700 dark:bg-charcoal-800"
            >
              <AnimatePresence>
                {activeCell === i && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0, rotate: -8 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: "backOut" }}
                    className="absolute inset-1"
                  >
                    <Image src="/MordiSinFondo.png" alt="Mordi" fill className="object-contain" sizes="120px" />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {floatingPlus
                  .filter((p) => p.cell === i)
                  .map((p) => (
                    <motion.span
                      key={p.id}
                      initial={{ opacity: 1, y: 0, scale: 0.8 }}
                      animate={{ opacity: 0, y: -36, scale: 1.2 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-2xl text-ember-500"
                    >
                      +1
                    </motion.span>
                  ))}
              </AnimatePresence>
            </button>
          ))}
        </div>

        <div className="mt-6">
          {state === "idle" && (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )}

          {state === "playing" && <p className="text-sm text-charcoal-400">¡Sigue así!</p>}

          {state === "finished" && (
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
                      {score} puntos
                    </p>
                  </motion.div>
                ) : (
                  <motion.p
                    key="normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream"
                  >
                    Terminaste con {score} puntos
                  </motion.p>
                )}
              </AnimatePresence>

              {!isNewRecord && bestScore > 0 && (
                <p className="text-xs text-charcoal-400">Tu récord personal: {bestScore}</p>
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

      <Leaderboard game={GAME_SLUG} refreshKey={leaderboardKey} />
    </div>
  );
}
