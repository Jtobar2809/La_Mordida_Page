"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leaderboard } from "@/components/games/Leaderboard";
import { submitGameScoreAction } from "@/actions/games";
import { cn } from "@/lib/utils";

const GAME_SLUG = "torre-de-ingredientes";
const BEST_SCORE_KEY = "lm_game_best_torre-de-ingredientes";

// Secuencia de ingredientes que se repite en bucle a medida que crece la
// torre. Cada uno tiene un gradiente de 2 tonos (en vez de un color
// sólido plano) para dar sensación de volumen real, como una foto de
// producto en vez de un bloque de color liso.
const INGREDIENTS = [
  { label: "Pan inferior", from: "#F0C97A", to: "#D9A15C", height: 22 },
  { label: "Carne", from: "#8A5237", to: "#5C3320", height: 20 },
  { label: "Queso", from: "#FBE27A", to: "#E8B93A", height: 12 },
  { label: "Tomate", from: "#EA6B5C", to: "#C23B31", height: 14 },
  { label: "Lechuga", from: "#9CC178", to: "#6E8F4C", height: 14 },
  { label: "Pan superior", from: "#F5CE8C", to: "#E0A55C", height: 24 },
] as const;

// INGREDIENTS nunca está vacío (literal fijo de 6 elementos definido
// arriba), así que el índice 0 siempre existe. Única aserción no-null
// del archivo, usada como fallback para cualquier índice fuera de rango.
const FALLBACK_INGREDIENT = INGREDIENTS[0]!;

const LAYER_WIDTH = 160; // ancho base de cada capa en px lógicos
const SWING_RANGE = 90; // cuánto se desplaza el ingrediente en movimiento a cada lado del centro
const BASE_SWING_MS = 1400; // duración de un ciclo completo de swing
const MIN_SWING_MS = 650; // piso de dificultad: no se acelera infinito
const SWING_SPEEDUP_PER_LAYER = 45; // ms que se recortan por cada capa apilada

// Sistema de "bamboleo" simulado (no es física real): cada mal
// aterrizaje suma inclinación acumulada a toda la torre; un buen
// aterrizaje la reduce un poco. Pasado el umbral, la torre se derrumba.
const WOBBLE_PER_MISS_UNIT = 2.2; // grados de inclinación por px de error de alineación
const WOBBLE_RECOVERY = 1.5; // grados que se recuperan en un buen aterrizaje
const WOBBLE_COLLAPSE_THRESHOLD = 26; // grados: a partir de aquí, se derrumba
const GOOD_LANDING_TOLERANCE = 10; // px de error considerados "aterrizaje limpio"

type GameState = "idle" | "playing" | "finished";
type PlacedLayer = { offsetX: number; ingredientIndex: number };

/**
 * Minijuego "Torre de Ingredientes" (inspirado en Suika Game / stacking
 * games): un ingrediente se mueve de lado a lado; al tocar, se suelta y
 * se apila. Si el desalineamiento con la capa anterior es grande, la
 * torre acumula "bamboleo" (un único valor de inclinación simulada, sin
 * motor de física); pasado el umbral, se derrumba. Cada capa acelera
 * ligeramente el swing, hasta un piso mínimo jugable.
 */
export function TorreDeIngredientes() {
  const { data: session } = useSession();
  const [state, setState] = React.useState<GameState>("idle");
  const [layers, setLayers] = React.useState<PlacedLayer[]>([]);
  const [wobble, setWobble] = React.useState(0);
  const [swingX, setSwingX] = React.useState(0);
  const [feedback, setFeedback] = React.useState<"perfect" | "good" | null>(null);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);

  const rafId = React.useRef(0);
  const swingStart = React.useRef(0);
  const feedbackTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const score = layers.length;
  const currentIngredient = INGREDIENTS[score % INGREDIENTS.length] ?? FALLBACK_INGREDIENT;

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  const swingDuration = Math.max(BASE_SWING_MS - score * SWING_SPEEDUP_PER_LAYER, MIN_SWING_MS);

  // ── Loop del swing horizontal (solo mueve un número, no toda la escena) ──
  React.useEffect(() => {
    if (state !== "playing") return;

    function tick(t: number) {
      if (!swingStart.current) swingStart.current = t;
      const elapsed = t - swingStart.current;
      const phase = (elapsed % swingDuration) / swingDuration; // 0..1
      const x = Math.sin(phase * Math.PI * 2) * SWING_RANGE;
      setSwingX(x);
      rafId.current = requestAnimationFrame(tick);
    }

    swingStart.current = 0;
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [state, score, swingDuration]);

  function startGame() {
    setLayers([]);
    setWobble(0);
    setSwingX(0);
    setIsNewRecord(false);
    setFeedback(null);
    setState("playing");
  }

  function drop() {
    if (state !== "playing") return;

    const previousOffset = layers.length > 0 ? (layers[layers.length - 1]?.offsetX ?? 0) : 0;
    const misalignment = Math.abs(swingX - previousOffset);

    let wobbleDelta = 0;
    if (misalignment <= GOOD_LANDING_TOLERANCE) {
      wobbleDelta = -WOBBLE_RECOVERY;
      setFeedback(misalignment <= 3 ? "perfect" : "good");
    } else {
      wobbleDelta = misalignment * WOBBLE_PER_MISS_UNIT * 0.01;
      setFeedback(null);
    }

    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setFeedback(null), 500);

    const newLayers = [...layers, { offsetX: swingX, ingredientIndex: layers.length % INGREDIENTS.length }];
    setLayers(newLayers);

    const nextWobble = Math.max(0, wobble + wobbleDelta);
    setWobble(nextWobble);

    if (nextWobble >= WOBBLE_COLLAPSE_THRESHOLD) {
      endGame(newLayers.length);
    }
  }

  function endGame(finalScore: number) {
    setState("finished");

    if (finalScore > bestScore) {
      setBestScore(finalScore);
      setIsNewRecord(true);
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(finalScore));
      } catch {
        // sin persistencia local, no es crítico
      }
    }

    if (session?.user) {
      submitGameScoreAction({ game: GAME_SLUG, score: finalScore }).then((result) => {
        if (result.success) {
          setLeaderboardKey((k) => k + 1);
        } else {
          toast.error(result.error);
        }
      });
    }
  }

  React.useEffect(() => {
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <Card className="p-6 text-center">
        <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">
          TORRE DE INGREDIENTES
        </h3>
        <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
          Toca cuando el ingrediente esté centrado para apilarlo derecho. ¡No dejes que se caiga!
        </p>

        <div className="mt-5 flex items-center justify-between text-sm font-semibold text-charcoal-700 dark:text-charcoal-200">
          <span>Capas: {score}</span>
          <AnimatePresence mode="wait">
            {feedback && (
              <motion.span
                key={feedback}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                className={cn(
                  "flex items-center gap-1",
                  feedback === "perfect" ? "text-mustard-400" : "text-ember-500"
                )}
              >
                <Sparkles className="h-4 w-4" /> {feedback === "perfect" ? "¡Perfecto!" : "¡Bien!"}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={drop}
          disabled={state !== "playing"}
          className="relative mt-4 h-72 w-full overflow-hidden rounded-2xl bg-gradient-to-b from-charcoal-100 to-charcoal-200 shadow-inner disabled:cursor-default dark:from-charcoal-900 dark:to-charcoal-800"
        >
          {/* Piso de apoyo, para que la torre no flote en el vacío */}
          <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-charcoal-300/60 to-transparent dark:from-charcoal-950/60" />

          {state === "playing" && (
            <div className="absolute left-1/2 top-6 h-4 w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-white/50 shadow-inner dark:bg-charcoal-950/40" />
          )}

          {state === "playing" && (
            <div
              className="absolute top-4 flex justify-center"
              style={{
                left: "50%",
                transform: `translateX(calc(-50% + ${swingX}px))`,
                width: LAYER_WIDTH,
              }}
            >
              <div
                className="rounded-lg shadow-lg ring-1 ring-black/10"
                style={{
                  width: LAYER_WIDTH,
                  height: currentIngredient.height,
                  background: `linear-gradient(180deg, ${currentIngredient.from}, ${currentIngredient.to})`,
                }}
              />
            </div>
          )}

          <motion.div
            className="absolute bottom-3 left-1/2 flex flex-col-reverse items-center"
            animate={{ rotate: wobble, x: wobble * 1.4 }}
            transition={{ type: "spring", stiffness: 120, damping: 10 }}
            style={{ transformOrigin: "bottom center" }}
          >
            {layers.map((layer, i) => {
              const ingredient = INGREDIENTS[layer.ingredientIndex] ?? FALLBACK_INGREDIENT;
              return (
                <motion.div
                  key={i}
                  initial={{ y: -60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="rounded-md shadow-md ring-1 ring-black/10"
                  style={{
                    width: LAYER_WIDTH,
                    height: ingredient.height,
                    background: `linear-gradient(180deg, ${ingredient.from}, ${ingredient.to})`,
                    transform: `translateX(${layer.offsetX}px)`,
                  }}
                />
              );
            })}
          </motion.div>

          {state === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-charcoal-400">
              Presiona &quot;Jugar&quot; para empezar
            </div>
          )}
        </button>

        <div className="mt-6">
          {state === "idle" && (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )}

          {state === "playing" && (
            <Button onClick={drop} size="lg" className="w-full">
              Soltar ingrediente
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
                      {score} capas
                    </p>
                  </motion.div>
                ) : (
                  <motion.p
                    key="normal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream"
                  >
                    Tu torre tenía {score} capas
                  </motion.p>
                )}
              </AnimatePresence>

              {!isNewRecord && bestScore > 0 && (
                <p className="text-xs text-charcoal-400">Tu récord personal: {bestScore} capas</p>
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
