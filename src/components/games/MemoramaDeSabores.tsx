"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Repeat, Shuffle, Timer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/games/Leaderboard";
import { MordiSprite, type MordiExpression } from "@/components/games/MordiSprite";
import { GameLayout, GameMeter, GameResult, GameShell, GameStat } from "@/components/games/GameShell";
import { useScoreSubmit } from "@/components/games/useScoreSubmit";
import { levelFor, ramp } from "@/components/games/difficulty";
import {
  IconBun,
  IconCheese,
  IconBacon,
  IconTomato,
  IconLettuce,
  IconChili,
} from "@/components/games/IngredientIcons";
import { cn } from "@/lib/utils";

const GAME_SLUG = "memorama-de-sabores";
const BEST_SCORE_KEY = "lm_game_best_memorama-de-sabores";

// 6 pares de ingredientes = 12 cartas en grid 4x3. Iconos SVG propios en
// vez de emojis: los emojis se ven distinto en cada sistema operativo
// (Windows/macOS/Android), lo que hacía que el juego luciera
// inconsistente; estos vectores son iguales en cualquier pantalla.
const FLAVORS = [
  { id: "bun", Icon: IconBun, from: "#FDF3DF", to: "#F3D9A4" },
  { id: "cheese", Icon: IconCheese, from: "#FFFBEF", to: "#FBE7B2" },
  { id: "bacon", Icon: IconBacon, from: "#FDECE3", to: "#F6C6B0" },
  { id: "tomato", Icon: IconTomato, from: "#FDEDE9", to: "#F5BFB4" },
  { id: "lettuce", Icon: IconLettuce, from: "#F1F6E8", to: "#D2E1B8" },
  { id: "chili", Icon: IconChili, from: "#FEF2EC", to: "#F8CDB6" },
] as const;

// FLAVORS nunca está vacío (literal fijo de 6 elementos definido
// arriba), así que el índice 0 siempre existe. Única aserción no-null
// del archivo, usada como fallback si algún flavorId no matchea (nunca
// debería pasar, ya que buildDeck solo usa ids de este mismo array).
const FALLBACK_FLAVOR = FLAVORS[0]!;

const TOTAL_PAIRS = FLAVORS.length;

// ── Dificultad progresiva ──
// La memoria no se entrena con velocidad, así que la escalada va por dos
// vías: el vistazo a un par fallido se acorta (hay menos tiempo para
// memorizar) y, pasada la mitad del tablero, las cartas que aún no se
// resolvieron se barajan entre sí después de cada error — el mapa mental
// que llevabas construido deja de servir.
const PEEK_MS_FROM = 900; // vistazo con 0 pares resueltos
const PEEK_MS_TO = 380; // vistazo con el tablero casi resuelto
const SHUFFLE_STARTS_AT_PAIRS = 2; // pares resueltos a partir de los cuales se baraja
const SHUFFLE_SWAPS_MAX = 3;

// El leaderboard ordena de mayor a menor score, pero "mejor" acá es
// menos tiempo y menos intentos. Igual que en Reacción Rápida,
// invertimos: score = BASE - tiempo(décimas de segundo) - intentos*20.
const SCORE_BASE = 3000;

type CardData = { id: number; flavorId: (typeof FLAVORS)[number]["id"]; matched: boolean };
type GameState = "idle" | "playing" | "finished";

function buildDeck(): CardData[] {
  const pairs = [...FLAVORS, ...FLAVORS];
  const deck = pairs.map((flavor, i) => ({ id: i, flavorId: flavor.id, matched: false }));
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

function getFlavor(id: (typeof FLAVORS)[number]["id"]) {
  return FLAVORS.find((f) => f.id === id) ?? FALLBACK_FLAVOR;
}

/**
 * Intercambia de posición `swaps` parejas de cartas todavía sin
 * resolver. Solo se mueven las no emparejadas: las ya resueltas se
 * quedan donde están, si no el tablero sería ilegible. El orden del
 * array ES el orden de la grilla, y las cartas se animan con `layout`,
 * así que el jugador ve deslizarse cada intercambio en vez de que las
 * cartas se teletransporten.
 */
function shuffleUnmatched(deck: CardData[], swaps: number): CardData[] {
  const next = [...deck];
  const movable = next.map((c, i) => (c.matched ? -1 : i)).filter((i) => i >= 0);
  if (movable.length < 2) return next;

  for (let s = 0; s < swaps; s++) {
    const a = movable[Math.floor(Math.random() * movable.length)];
    const b = movable[Math.floor(Math.random() * movable.length)];
    if (a === undefined || b === undefined || a === b) continue;
    const cardA = next[a];
    const cardB = next[b];
    if (!cardA || !cardB) continue;
    next[a] = cardB;
    next[b] = cardA;
  }
  return next;
}

/**
 * Minijuego "Memorama de Sabores": grid de 12 cartas (6 pares de
 * ingredientes), encuentra los pares con el menor tiempo e intentos
 * posibles. El reverso de cada carta usa a MordiSprite (SVG inline) en
 * vez de la imagen PNG — dentro del flip 3D (rotateY + backface-
 * visibility), next/image con `fill` podía fallar a resolver su tamaño
 * a tiempo y Mordi quedaba invisible; el SVG no depende de layout ni de
 * red, siempre se pinta. Los 12 sprites se dibujan con `animate={false}`
 * porque doce animaciones en bucle simultáneas no aportan nada y sí
 * cuestan frames en móviles.
 */
export function MemoramaDeSabores() {
  const { submit, leaderboardKey, savedAs } = useScoreSubmit(GAME_SLUG);
  const [deck, setDeck] = React.useState<CardData[]>([]);
  const [flipped, setFlipped] = React.useState<number[]>([]); // ids de cartas actualmente boca arriba (sin match aún)
  const [attempts, setAttempts] = React.useState(0);
  const [elapsedMs, setElapsedMs] = React.useState(0);
  const [state, setState] = React.useState<GameState>("idle");
  const [locked, setLocked] = React.useState(false); // evita clicks durante la pausa de "no combinan"
  const [lastMatch, setLastMatch] = React.useState<number[]>([]); // ids del par recién resuelto, para el destello
  const [shuffling, setShuffling] = React.useState(false); // aviso visual de que el tablero se barajó
  const [bestScore, setBestScore] = React.useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = React.useState(false);

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
    setLastMatch([]);
    setShuffling(false);
    setState("playing");

    startedAt.current = Date.now();
    if (timerInterval.current) clearInterval(timerInterval.current);
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

      if (first.flavorId === second.flavorId) {
        // Match: marcar como resuelto casi al instante (deja ver el flip)
        setTimeout(() => {
          setDeck((d) => d.map((c) => (c.id === firstId || c.id === secondId ? { ...c, matched: true } : c)));
          setFlipped([]);
          setLastMatch([firstId ?? -1, secondId ?? -1]);
          setTimeout(() => setLastMatch([]), 600);
        }, 250);
      } else {
        // Fallo: el vistazo dura menos cuantos más pares lleves, y pasado
        // cierto punto el tablero se baraja al ocultarse las cartas.
        const solved = deck.filter((c) => c.matched).length / 2;
        const peekMs = ramp(solved, PEEK_MS_FROM, PEEK_MS_TO, TOTAL_PAIRS - 1);
        const swaps = solved >= SHUFFLE_STARTS_AT_PAIRS ? Math.min(SHUFFLE_SWAPS_MAX, solved - 1) : 0;

        setLocked(true);
        setTimeout(() => {
          setFlipped([]);
          if (swaps > 0) {
            setDeck((d) => shuffleUnmatched(d, swaps));
            setShuffling(true);
            setTimeout(() => setShuffling(false), 700);
          }
          setLocked(false);
        }, peekMs);
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
  const pairsFound = deck.filter((c) => c.matched).length / 2;

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

    submit(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const mordiMood: MordiExpression =
    state === "finished" ? (isNewRecord ? "love" : "wink") : locked ? "dizzy" : state === "playing" ? "determined" : "happy";

  return (
    <GameLayout>
      <GameShell
        title="MEMORAMA DE SABORES"
        subtitle="Encuentra los 6 pares de ingredientes con el menor tiempo y los menos intentos posibles."
        mordi={mordiMood}
        hud={
          <>
            <GameStat icon={<Check className="h-4 w-4" />} label="Pares" value={`${pairsFound}/${TOTAL_PAIRS}`} tone={pairsFound === TOTAL_PAIRS ? "gold" : "neutral"} />
            <GameStat icon={<Repeat className="h-4 w-4" />} label="Intentos" value={attempts} />
            <GameStat
              icon={<TrendingUp className="h-4 w-4" />}
              label="Nivel"
              value={levelFor(pairsFound, 1, TOTAL_PAIRS)}
              tone={pairsFound >= SHUFFLE_STARTS_AT_PAIRS ? "ember" : "neutral"}
            />
            <GameStat icon={<Timer className="h-4 w-4" />} value={`${seconds}s`} tone="ember" />
            <div className="mt-1 w-full">
              <GameMeter value={pairsFound / TOTAL_PAIRS} tone="gold" />
            </div>
          </>
        }
        footer={
          state === "finished" ? (
            <GameResult
              isNewRecord={isNewRecord}
              headline={`${seconds}s · ${attempts} intentos`}
              detail="¡Encontraste todos los pares!"
              bestLabel={bestScore !== null ? `Tu mejor puntaje: ${bestScore} pts` : undefined}
              savedAs={savedAs}
              onReplay={startGame}
            />
          ) : state === "playing" ? (
            <p className="text-center text-sm text-charcoal-500 dark:text-charcoal-300">
              {pairsFound >= TOTAL_PAIRS - 1
                ? "¡Último par!"
                : pairsFound >= SHUFFLE_STARTS_AT_PAIRS
                  ? "Cuidado: ahora las cartas sin resolver se barajan tras cada error"
                  : "Memoriza dónde está cada ingrediente"}
            </p>
          ) : (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )
        }
      >
        <div
          className="relative mx-auto grid max-w-sm grid-cols-4 gap-2 rounded-xl p-2.5 sm:gap-2.5"
          style={{
            background: "linear-gradient(180deg,#3B2A1E 0%,#241812 60%,#181008 100%)",
            boxShadow: "inset 0 2px 12px rgba(0,0,0,0.55)",
          }}
        >
          {state === "idle" &&
            Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="relative aspect-[3/4] rounded-xl bg-gradient-to-br from-charcoal-700 to-charcoal-900 opacity-70 ring-1 ring-white/5"
              />
            ))}

          {deck.map((card) => {
            const isFlipped = flipped.includes(card.id) || card.matched;
            const flavor = getFlavor(card.flavorId);
            const Icon = flavor.Icon;
            const justMatched = lastMatch.includes(card.id);
            return (
              // `layout` es lo que hace legible el barajado: al reordenar el
              // array, Framer interpola la carta de su celda vieja a la nueva
              // en vez de teletransportarla.
              <motion.button
                key={card.id}
                layout
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                type="button"
                onClick={() => handleCardClick(card.id)}
                disabled={card.matched || isFlipped}
                className="relative aspect-[3/4] [perspective:800px]"
              >
                <motion.div
                  className="relative h-full w-full [transform-style:preserve-3d]"
                  animate={{ rotateY: isFlipped ? 180 : 0, scale: justMatched ? 1.06 : 1 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  {/* Reverso (boca abajo) — Mordi sobre el patrón de la marca */}
                  <div
                    className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl p-1.5 shadow-md ring-1 ring-black/20 [backface-visibility:hidden]"
                    style={{
                      background:
                        "linear-gradient(135deg,#E85C2B 0%,#F0A93A 100%)," +
                        "repeating-linear-gradient(45deg, rgba(255,255,255,0.12) 0 6px, transparent 6px 12px)",
                    }}
                  >
                    <div
                      aria-hidden
                      className="absolute inset-0 opacity-25"
                      style={{
                        background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 5px, transparent 5px 12px)",
                      }}
                    />
                    <div className="absolute inset-1 rounded-lg ring-1 ring-white/30" />
                    <MordiSprite expression="happy" animate={false} className="relative h-full w-full drop-shadow" />
                  </div>

                  {/* Frente (boca arriba) — ingrediente */}
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center rounded-xl p-2.5 shadow-md ring-1 ring-black/10 [backface-visibility:hidden] [transform:rotateY(180deg)]",
                      card.matched && "ring-2 ring-emerald-400"
                    )}
                    style={{
                      background: `linear-gradient(160deg, ${flavor.from} 0%, ${flavor.to} 100%)`,
                      boxShadow: card.matched
                        ? "0 0 16px rgba(52,211,153,0.55), inset 0 1px 0 rgba(255,255,255,0.7)"
                        : "inset 0 1px 0 rgba(255,255,255,0.7)",
                    }}
                  >
                    <Icon className="h-full w-full drop-shadow-sm" />
                    {card.matched && (
                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </motion.div>

                {/* Destello al resolver el par */}
                <AnimatePresence>
                  {justMatched && (
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0.85 }}
                      animate={{ scale: 1.35, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                      className="pointer-events-none absolute inset-0 rounded-xl border-2 border-emerald-300"
                    />
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}

          {/* Aviso de barajado: sin esto, ver moverse las cartas parece un bug */}
          <AnimatePresence>
            {shuffling && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center"
              >
                <span className="flex items-center gap-1.5 rounded-full bg-ember-500 px-4 py-1.5 font-display text-sm tracking-wide text-white shadow-lg">
                  <Shuffle className="h-4 w-4" /> ¡SE BARAJARON!
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GameShell>

      <Leaderboard game={GAME_SLUG} refreshKey={leaderboardKey} formatScore={(s) => `${s} pts`} />
    </GameLayout>
  );
}
