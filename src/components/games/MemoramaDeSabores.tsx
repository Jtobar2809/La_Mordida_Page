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

const GAME_SLUG = "memorama-de-sabores";
const BEST_SCORE_KEY = "lm_game_best_memorama-de-sabores";

// 6 pares de ingredientes = 12 cartas en grid 4x3
const FLAVORS = ["🍔", "🧀", "🥓", "🍅", "🥬", "🌶️"];

const MISMATCH_HIDE_DELAY_MS = 700; // tiempo que quedan visibles 2 cartas que no combinan antes de voltearse de nuevo

// El leaderboard ordena de mayor a menor score, pero "mejor" acá es
// menos tiempo y menos intentos. Igual que en Reacción Rápida,
// invertimos: score = BASE - tiempo(décimas de segundo) - intentos*20.
const SCORE_BASE = 3000;

type CardData = { id: number; flavor: string; matched: boolean };
type GameState = "idle" | "playing" | "finished";

function buildDeck(): CardData[] {
  const pairs = [...FLAVORS, ...FLAVORS];
  const deck = pairs.map((flavor, i) => ({ id: i, flavor, matched: false }));
  // shuffle Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = deck[i];
    const b = deck[j];
    if (a && b) {
      deck[i] = b;
      deck[j] = a;
    }
  }
  return deck;
}

/**
 * Minijuego "Memorama de Sabores": grid de 12 cartas (6 pares de
 * ingredientes), encuentra los pares con el menor tiempo e intentos
 * posibles. El reverso de cada carta usa a Mordi para reforzar marca.
 * El más liviano de construir de los 10: solo estado de grid + un
 * temporizador, sin física ni Canvas — pero con flip 3D real (CSS
 * transform-style: preserve-3d) para que se sienta satisfactorio.
 */
export function MemoramaDeSabores() {
  const { data: session } = useSession();
  const [deck, setDeck] = React.useState<CardData[]>([]);
  const [flipped, setFlipped] = React.useState<number[]>([]); // ids de cartas actualmente boca arriba (sin match aún)
  const [attempts, setAttempts] = React.useState(0);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [state, setState] = React.useState<GameState>("idle");
  const [locked, setLocked] = React.useState(false); // evita clicks durante la pausa de "no combinan"
  const [bestScore, setBestScore] = React.useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);

  const timerInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = React.useRef(0);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored));
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  function startGame() {
    setDeck(buildDeck());
    setFlipped([]);
    setAttempts(0);
    setElapsedMs(0);
    setIsNewRecord(false);
    setLocked(false);
    setState("playing");

    startedAt.current = Date.now();
    timerInterval.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current);
    }, 100);
  }

  function handleCardClick(id: number) {
    if (state !== "playing" || locked) return;
    const card = deck.find((c) => c.id === id);
    if (!card || card.matched || flipped.includes(id)) return;

    const nextFlipped = [...flipped, id];
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setAttempts((a) => a + 1);
      const [firstId, secondId] = nextFlipped;
      const first = deck.find((c) => c.id === firstId);
      const second = deck.find((c) => c.id === secondId);
      if (!first || !second) return;

      if (first.flavor === second.flavor) {
        // Match: marcar como resuelto casi al instante (deja ver el flip)
        setTimeout(() => {
          setDeck((d) => d.map((c) => (c.id === firstId || c.id === secondId ? { ...c, matched: true } : c)));
          setFlipped([]);
        }, 250);
      } else {
        setLocked(true);
        setTimeout(() => {
          setFlipped([]);
          setLocked(false);
        }, MISMATCH_HIDE_DELAY_MS);
      }
    }
  }

  // Detecta victoria: todas las cartas emparejadas
  React.useEffect(() => {
    if (state !== "playing" || deck.length === 0) return;
    if (deck.every((c) => c.matched)) {
      finishGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  function finishGame() {
    if (timerInterval.current) clearInterval(timerInterval.current);
    setState("finished");
  }

  const score = Math.max(0, Math.round(SCORE_BASE - elapsedMs / 100 - attempts * 20));
  const seconds = (elapsedMs / 1000).toFixed(1);

  React.useEffect(() => {
    if (state !== "finished") return;

    const isBetter = bestScore === null || score > bestScore;
    if (isBetter) {
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
        <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">
          MEMORAMA DE SABORES
        </h3>
        <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
          Encuentra los 6 pares con el menor tiempo e intentos posibles.
        </p>

        <div className="mt-4 flex items-center justify-between text-sm font-semibold text-charcoal-700 dark:text-charcoal-200">
          <span>Intentos: {attempts}</span>
          <span>{state !== "idle" ? `⏱ ${seconds}s` : null}</span>
        </div>

        <div className="relative mx-auto mt-4 grid max-w-sm grid-cols-4 gap-2">
          {state === "idle" &&
            Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="relative aspect-[3/4] rounded-lg bg-charcoal-100 dark:bg-charcoal-800"
              />
            ))}

          {deck.map((card) => {
            const isFlipped = flipped.includes(card.id) || card.matched;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleCardClick(card.id)}
                disabled={card.matched || isFlipped}
                className="relative aspect-[3/4] [perspective:800px]"
              >
                <motion.div
                  className="relative h-full w-full rounded-lg [transform-style:preserve-3d]"
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  {/* Reverso (boca abajo) — logo de Mordi */}
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-ember-gradient [backface-visibility:hidden]">
                    <div className="relative h-7 w-7">
                      <Image src="/MordiSinFondo.png" alt="" fill className="object-contain" />
                    </div>
                  </div>
                  {/* Frente (boca arriba) — ingrediente */}
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center rounded-lg text-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]",
                      card.matched
                        ? "bg-emerald-100 dark:bg-emerald-500/20"
                        : "bg-charcoal-50 dark:bg-charcoal-800"
                    )}
                  >
                    {card.flavor}
                  </div>
                </motion.div>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {state === "idle" && (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )}

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
                      {seconds}s · {attempts} intentos
                    </p>
                  </motion.div>
                ) : (
                  <motion.p
                    key="normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream"
                  >
                    {seconds}s con {attempts} intentos
                  </motion.p>
                )}
              </AnimatePresence>

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

      <Leaderboard game={GAME_SLUG} refreshKey={leaderboardKey} formatScore={(s) => `${s} pts`} />
    </div>
  );
}
