"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Target, Timer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/games/Leaderboard";
import { MordiSprite, type MordiExpression } from "@/components/games/MordiSprite";
import { IconChili } from "@/components/games/IngredientIcons";
import { GameLayout, GameMeter, GameResult, GameShell, GameStat } from "@/components/games/GameShell";
import { useScoreSubmit } from "@/components/games/useScoreSubmit";
import { chanceFor, levelFor, ramp } from "@/components/games/difficulty";
import { cn } from "@/lib/utils";

const GAME_SLUG = "atrapa-la-mordida";
const BEST_SCORE_KEY = "lm_game_best_atrapa-la-mordida";

const GRID_SIZE = 9; // grid 3x3
const GAME_DURATION_MS = 25_000;
const TICK_MS = 80; // resolución del reloj: suficiente para animar la barra sin re-renderizar de más

// ── Dificultad progresiva ──
// La ventana de aparición se acorta con cada acierto, y a partir de
// cierto puntaje empiezan a salir chiles: si tocas uno, pierdes racha y
// un mordisco de tiempo. Así el juego no escala solo en reflejos sino
// también en atención — mirar antes de tocar.
const RAMP_OVER = 22; // aciertos que toma llegar a la dificultad máxima
const WINDOW_MIN_FROM = 700;
const WINDOW_MIN_TO = 230;
const WINDOW_MAX_FROM = 1050;
const WINDOW_MAX_TO = 360;

const CHILI_STARTS_AT = 6; // primeros aciertos sin señuelos: se aprende el juego
const CHILI_MAX_CHANCE = 0.34;
const CHILI_RAMP_OVER = 18;
const CHILI_TIME_PENALTY_MS = 1500;

type GameState = "idle" | "playing" | "finished";
type Popper = { cell: number; kind: "mordi" | "chili" };
type Burst = { id: number; cell: number; kind: "hit" | "chili" };

function randomCell(exclude?: number) {
  let cell = Math.floor(Math.random() * GRID_SIZE);
  if (exclude !== undefined) {
    while (cell === exclude) cell = Math.floor(Math.random() * GRID_SIZE);
  }
  return cell;
}

/** Cuánto tiempo queda visible el personaje, según cuántos aciertos lleva el jugador */
function visibleWindowMs(score: number) {
  const minMs = ramp(score, WINDOW_MIN_FROM, WINDOW_MIN_TO, RAMP_OVER);
  const maxMs = ramp(score, WINDOW_MAX_FROM, WINDOW_MAX_TO, RAMP_OVER);
  return minMs + Math.random() * (maxMs - minMs);
}

/**
 * Minijuego "Atrapa la Mordida": Mordi se asoma por una de las nueve
 * bocas de la parrilla durante una ventana de tiempo que se acorta con
 * cada acierto. Desde el sexto acierto empiezan a asomarse chiles como
 * señuelo, con probabilidad creciente.
 *
 * El ciclo de aparición se maneja íntegramente con refs y un `runId`,
 * NO con setState. La versión anterior llamaba a la función que
 * programaba la siguiente aparición desde dentro de un updater de
 * `setActiveCell`, es decir, durante la fase de render: React invoca los
 * updaters varias veces (dos en StrictMode, más si detecta
 * actualizaciones en fase de render), así que nacían varias cadenas de
 * timeouts paralelas que se pisaban entre sí — cada una veía la celda de
 * otra, decidía que ya no le correspondía reprogramar, y moría. Tras dos
 * o tres apariciones no quedaba ninguna cadena viva y Mordi no volvía a
 * salir nunca. Ahora la única fuente de verdad es `activeRef`, la
 * reprogramación ocurre en el callback del timeout (fuera del render) y
 * `runId` invalida cualquier timeout huérfano de una partida anterior.
 */
export function AtrapaLaMordida() {
  const { submit, leaderboardKey, savedAs } = useScoreSubmit(GAME_SLUG);
  const [state, setState] = React.useState<GameState>("idle");
  const [active, setActive] = React.useState<Popper | null>(null);
  const [score, setScore] = React.useState(0);
  const [combo, setCombo] = React.useState(0);
  const [bestCombo, setBestCombo] = React.useState(0);
  const [timeLeftMs, setTimeLeftMs] = React.useState(GAME_DURATION_MS);
  const [bursts, setBursts] = React.useState<Burst[]>([]);
  const [missCell, setMissCell] = React.useState<number | null>(null);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);

  // ── Estado del ciclo de aparición, fuera de React ──
  const runIdRef = React.useRef(0); // invalida timeouts de partidas anteriores
  const activeRef = React.useRef<Popper | null>(null);
  const scoreRef = React.useRef(0);
  const comboRef = React.useRef(0);
  const deadlineRef = React.useRef(0); // se acorta al tocar un chile
  const appearTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const burstId = React.useRef(0);
  const missTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // localStorage no disponible — sin récord persistido, no es crítico
    }
  }, []);

  const clearTimers = React.useCallback(() => {
    if (appearTimeout.current) clearTimeout(appearTimeout.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    if (missTimeout.current) clearTimeout(missTimeout.current);
    appearTimeout.current = null;
    countdownInterval.current = null;
    missTimeout.current = null;
  }, []);

  /**
   * Asoma a alguien (Mordi o un chile) en una celda y programa su
   * desaparición. Si expira sin que lo atrapen, rompe la racha —solo si
   * era Mordi— y se vuelve a llamar a sí misma. Siempre corre fuera del
   * render (callback de timeout o handler de click), nunca dentro de un
   * updater de setState.
   */
  const spawn = React.useCallback((runId: number, previousCell?: number) => {
    if (runIdRef.current !== runId) return;

    const cell = randomCell(previousCell);
    const chiliChance = chanceFor(scoreRef.current, CHILI_STARTS_AT, CHILI_MAX_CHANCE, CHILI_RAMP_OVER);
    const popper: Popper = { cell, kind: Math.random() < chiliChance ? "chili" : "mordi" };

    activeRef.current = popper;
    setActive(popper);

    appearTimeout.current = setTimeout(() => {
      if (runIdRef.current !== runId) return; // partida ya terminada o reiniciada
      if (activeRef.current !== popper) return; // ya lo atraparon
      activeRef.current = null;
      setActive(null);
      if (popper.kind === "mordi") {
        // Dejar escapar a Mordi rompe la racha; dejar pasar un chile no.
        comboRef.current = 0;
        setCombo(0);
      }
      spawn(runId, cell);
    }, visibleWindowMs(scoreRef.current));
  }, []);

  const endGame = React.useCallback(() => {
    runIdRef.current += 1; // invalida cualquier timeout en vuelo
    clearTimers();
    activeRef.current = null;
    setActive(null);
    setTimeLeftMs(0);
    setState("finished");
  }, [clearTimers]);

  const startGame = React.useCallback(() => {
    clearTimers();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    scoreRef.current = 0;
    comboRef.current = 0;
    activeRef.current = null;
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeLeftMs(GAME_DURATION_MS);
    setIsNewRecord(false);
    setBursts([]);
    setMissCell(null);
    setState("playing");

    spawn(runId);

    deadlineRef.current = performance.now() + GAME_DURATION_MS;
    countdownInterval.current = setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - performance.now());
      setTimeLeftMs(remaining);
      if (remaining <= 0) endGame();
    }, TICK_MS);
  }, [clearTimers, endGame, spawn]);

  function pushBurst(cell: number, kind: Burst["kind"]) {
    const id = burstId.current++;
    setBursts((b) => [...b, { id, cell, kind }]);
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 650);
  }

  function shakeCell(cell: number) {
    setMissCell(cell);
    if (missTimeout.current) clearTimeout(missTimeout.current);
    missTimeout.current = setTimeout(() => setMissCell(null), 240);
  }

  function handleCellClick(index: number) {
    if (state !== "playing") return;

    const current = activeRef.current;

    // Boca vacía: corta la racha, no resta puntos
    if (!current || index !== current.cell) {
      comboRef.current = 0;
      setCombo(0);
      shakeCell(index);
      return;
    }

    const runId = runIdRef.current;
    if (appearTimeout.current) clearTimeout(appearTimeout.current);
    activeRef.current = null;
    setActive(null);

    if (current.kind === "chili") {
      // Señuelo: racha a cero y mordisco al reloj
      comboRef.current = 0;
      setCombo(0);
      deadlineRef.current -= CHILI_TIME_PENALTY_MS;
      shakeCell(index);
      pushBurst(index, "chili");
      spawn(runId, index);
      return;
    }

    scoreRef.current += 1;
    comboRef.current += 1;
    setScore(scoreRef.current);
    setCombo(comboRef.current);
    setBestCombo((b) => Math.max(b, comboRef.current));
    pushBurst(index, "hit");

    spawn(runId, index);
  }

  React.useEffect(() => clearTimers, [clearTimers]);

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

    submit(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const timeRatio = timeLeftMs / GAME_DURATION_MS;
  const running = state === "playing";
  const level = levelFor(score, 4);

  const mordiMood: MordiExpression =
    state === "finished"
      ? isNewRecord
        ? "love"
        : score > 0
          ? "wink"
          : "sad"
      : running
        ? combo >= 5
          ? "cool"
          : "determined"
        : "happy";

  return (
    <GameLayout>
      <GameShell
        title="ATRAPA LA MORDIDA"
        subtitle="Mordi se asoma por la parrilla. Tócalo antes de que se esconda — pero cuidado con los chiles: te queman la racha y el reloj."
        mordi={mordiMood}
        hud={
          <>
            <GameStat icon={<Target className="h-4 w-4" />} label="Puntos" value={score} />
            <GameStat
              icon={<Flame className={cn("h-4 w-4", combo >= 5 && "animate-pulse")} />}
              label="Racha"
              value={`x${combo}`}
              tone={combo >= 8 ? "gold" : combo >= 3 ? "ember" : "neutral"}
            />
            <GameStat icon={<TrendingUp className="h-4 w-4" />} label="Nivel" value={level} tone={level >= 4 ? "ember" : "neutral"} />
            <GameStat
              icon={<Timer className="h-4 w-4" />}
              value={`${running || state === "finished" ? secondsLeft : 25}s`}
              tone={running && secondsLeft <= 5 ? "danger" : "neutral"}
            />
            <div className="mt-1 w-full">
              <GameMeter value={running ? timeRatio : 1} tone={secondsLeft <= 5 && running ? "danger" : "ember"} />
            </div>
          </>
        }
        footer={
          state === "finished" ? (
            <GameResult
              isNewRecord={isNewRecord}
              headline={`${score} ${score === 1 ? "mordida" : "mordidas"}`}
              detail={bestCombo >= 3 ? `Mejor racha: x${bestCombo}` : undefined}
              bestLabel={bestScore > 0 ? `Tu récord personal: ${bestScore}` : undefined}
              savedAs={savedAs}
              onReplay={startGame}
            />
          ) : running ? (
            <p className="text-center text-sm font-medium text-charcoal-500 dark:text-charcoal-300">
              {score >= CHILI_STARTS_AT
                ? "¡Ojo con los chiles! 🌶️"
                : combo >= 4
                  ? "¡Sigue así!"
                  : "Atento a la parrilla…"}
            </p>
          ) : (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )
        }
      >
        {/* Tablero: plancha de parrilla con nueve bocas */}
        <div
          className="grid grid-cols-3 gap-2 rounded-xl p-2.5 sm:gap-2.5 sm:p-3"
          style={{
            background:
              "linear-gradient(180deg,#3B2A1E 0%,#241812 55%,#181008 100%)," +
              "repeating-linear-gradient(90deg,rgba(0,0,0,0.25) 0 2px,transparent 2px 16px)",
            boxShadow: "inset 0 2px 12px rgba(0,0,0,0.55)",
          }}
        >
          {Array.from({ length: GRID_SIZE }).map((_, i) => {
            const isActive = active?.cell === i;
            const isChili = isActive && active?.kind === "chili";
            return (
              <motion.button
                key={i}
                type="button"
                onClick={() => handleCellClick(i)}
                disabled={!running}
                animate={missCell === i ? { x: [0, -4, 4, -3, 0] } : { x: 0 }}
                transition={{ duration: 0.22 }}
                aria-label={`Boca ${i + 1}`}
                className="relative aspect-square overflow-hidden rounded-2xl disabled:cursor-default"
                style={{
                  background: "radial-gradient(120% 100% at 50% 0%, #4A3527 0%, #2A1D14 55%, #150E09 100%)",
                  boxShadow: "inset 0 3px 10px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {/* Boca del horno: hueco oscuro al fondo */}
                <div className="pointer-events-none absolute inset-x-[16%] bottom-[14%] h-[30%] rounded-[50%] bg-black/70" />

                {/* Resplandor: cálido para Mordi, rojo de peligro para el chile */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: isChili
                          ? "radial-gradient(circle at 50% 70%, rgba(220,40,30,0.5) 0%, rgba(220,40,30,0) 65%)"
                          : "radial-gradient(circle at 50% 70%, rgba(232,92,43,0.45) 0%, rgba(232,92,43,0) 65%)",
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Quien se asoma */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      key={isChili ? "chili" : "mordi"}
                      initial={{ y: "55%", scale: 0.75, opacity: 0 }}
                      animate={{ y: "0%", scale: 1, opacity: 1 }}
                      exit={{ y: "60%", scale: 0.7, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 560, damping: 28 }}
                      className="pointer-events-none absolute inset-x-[10%] bottom-[18%] top-[6%]"
                    >
                      {isChili ? (
                        <IconChili className="h-full w-full drop-shadow-lg" />
                      ) : (
                        <MordiSprite expression="surprised" animate={false} className="h-full w-full drop-shadow-lg" />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Labio frontal de la boca: tapa la base para que parezca que sale del hueco */}
                <div
                  className="pointer-events-none absolute inset-x-[8%] bottom-[6%] h-[26%] rounded-[50%]"
                  style={{
                    background: "linear-gradient(180deg,#5A422F 0%,#33241A 45%,#1A120C 100%)",
                    boxShadow: "0 -3px 10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)",
                  }}
                />

                {/* Impacto: anillo + marcador.
                    Sin AnimatePresence: cada burst se retira solo con su propio
                    timeout y solo tiene animación de entrada, así que envolverlos
                    costaría un Fragment que AnimatePresence no sabe rastrear. */}
                {bursts
                  .filter((b) => b.cell === i)
                  .map((b) => (
                    <motion.span
                      key={`ring-${b.id}`}
                      initial={{ scale: 0.3, opacity: 0.9 }}
                      animate={{ scale: 1.7, opacity: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className={cn(
                        "pointer-events-none absolute inset-[18%] z-10 rounded-full border-[3px]",
                        b.kind === "hit" ? "border-mustard-300" : "border-red-400"
                      )}
                    />
                  ))}
                {bursts
                  .filter((b) => b.cell === i)
                  .map((b) => (
                    <motion.span
                      key={`plus-${b.id}`}
                      initial={{ opacity: 1, y: 4, scale: 0.7 }}
                      animate={{ opacity: 0, y: -34, scale: 1.25 }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                      className={cn(
                        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center font-display drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]",
                        b.kind === "hit" ? "text-2xl text-mustard-200" : "text-lg text-red-300"
                      )}
                    >
                      {b.kind === "hit" ? "+1" : `-${CHILI_TIME_PENALTY_MS / 1000}s`}
                    </motion.span>
                  ))}
              </motion.button>
            );
          })}
        </div>
      </GameShell>

      <Leaderboard game={GAME_SLUG} refreshKey={leaderboardKey} />
    </GameLayout>
  );
}
