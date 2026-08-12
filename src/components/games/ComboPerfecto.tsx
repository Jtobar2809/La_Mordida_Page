"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Target, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/games/Leaderboard";
import { MordiSprite, type MordiExpression } from "@/components/games/MordiSprite";
import { GameLayout, GameResult, GameShell, GameStat } from "@/components/games/GameShell";
import {
  IconBun,
  IconBunDouble,
  IconCheese,
  IconTomato,
  IconLettuce,
  IconPatty,
  IconBacon,
  IconBurgerComplete,
} from "@/components/games/IngredientIcons";
import { useScoreSubmit } from "@/components/games/useScoreSubmit";
import { chanceFor, levelFor, ramp } from "@/components/games/difficulty";
import { cn } from "@/lib/utils";

const GAME_SLUG = "combo-perfecto";
const BEST_SCORE_KEY = "lm_game_best_combo-perfecto";

const GRID_SIZE = 4;

// ── Dificultad progresiva ──
// El 2048 clásico se endurece solo porque el tablero se llena, pero muy
// lentamente. Aquí se acelera por dos vías: las fichas nuevas son cada
// vez más pobres (casi siempre nivel 0, que obliga a más fusiones) y a
// partir de cierto puntaje a veces caen dos de golpe, que es lo que
// realmente ahoga el espacio libre.
const RAMP_OVER_POINTS = 2000;
const LOW_TILE_CHANCE_FROM = 0.9; // probabilidad de que la ficha nueva sea nivel 0
const LOW_TILE_CHANCE_TO = 0.97;
const DOUBLE_SPAWN_STARTS_AT = 300;
const DOUBLE_SPAWN_MAX_CHANCE = 0.55;

// Niveles del ingrediente, en orden de fusión: 2 "Pan" se fusionan en 1
// "Pan doble", 2 "Pan doble" en "Queso", etc. — hasta llegar a la
// hamburguesa completa (nivel máximo), que es la "meta" visual del juego.
// Iconos SVG propios en vez de emojis (consistencia visual entre
// sistemas operativos), con gradiente de 2 tonos por nivel para dar
// sensación de profundidad en vez de bloques de color plano.
const LEVELS = [
  { label: "Pan", Icon: IconBun, from: "#F7E3BC", to: "#DFAF60" },
  { label: "Pan x2", Icon: IconBunDouble, from: "#EFC98F", to: "#C4873A" },
  { label: "Queso", Icon: IconCheese, from: "#FDEB9C", to: "#E4B02C" },
  { label: "Tomate", Icon: IconTomato, from: "#F2837A", to: "#B8342A" },
  { label: "Lechuga", Icon: IconLettuce, from: "#B4D493", to: "#63813F" },
  { label: "Carne", Icon: IconPatty, from: "#9A6042", to: "#4E2A1A" },
  { label: "Tocino", Icon: IconBacon, from: "#E2837A", to: "#9E3227" },
  { label: "¡Mordida!", Icon: IconBurgerComplete, from: "#F5B26A", to: "#E85C2B" },
] as const;

// LEVELS nunca está vacío (es un literal fijo definido arriba, con 8
// elementos escritos a mano), así que el índice 0 siempre existe.
// Esta es la única aserción no-null del archivo, y sirve como fallback
// único para cualquier índice fuera de rango en el resto del código.
const FALLBACK_LEVEL = LEVELS[0]!;

type Cell = number | null; // índice a LEVELS, o null = vacía
type Grid = Cell[][];
type Direction = "up" | "down" | "left" | "right";
type GameState = "idle" | "playing" | "finished";

function emptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array<Cell>(GRID_SIZE).fill(null));
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

function emptyCells(grid: Grid): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = grid[r];
    if (!row) continue;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (row[c] === null) cells.push([r, c]);
    }
  }
  return cells;
}

/**
 * Coloca una ficha nueva en una celda vacía aleatoria. `lowChance` es la
 * probabilidad de que salga de nivel 0 (la peor): sube con el puntaje,
 * así que avanzar exige cada vez más fusiones.
 */
function spawnTile(grid: Grid, lowChance = LOW_TILE_CHANCE_FROM): Grid {
  const empties = emptyCells(grid);
  if (empties.length === 0) return grid;
  const target = empties[Math.floor(Math.random() * empties.length)];
  if (!target) return grid;
  const [r, c] = target;
  const next = cloneGrid(grid);
  const row = next[r];
  if (row) row[c] = Math.random() < lowChance ? 0 : 1;
  return next;
}

/**
 * Desliza y fusiona una sola línea (fila o columna, ya extraída como
 * array de longitud GRID_SIZE) hacia el extremo "menor" del array.
 * Devuelve la línea resultante + puntos ganados por fusiones en esa
 * línea. Se reutiliza para las 4 direcciones rotando la grilla antes.
 */
function collapseLine(line: Cell[]): { line: Cell[]; gained: number } {
  const values = line.filter((v): v is number => v !== null);
  const result: Cell[] = [];
  let gained = 0;

  let i = 0;
  while (i < values.length) {
    const current = values[i];
    const nextVal = values[i + 1];
    if (current === undefined) break;
    if (nextVal !== undefined && current === nextVal && current < LEVELS.length - 1) {
      const fused = current + 1;
      result.push(fused);
      gained += (fused + 1) * 10; // fusiones de nivel más alto valen más puntos
      i += 2;
    } else {
      result.push(current);
      i += 1;
    }
  }

  while (result.length < GRID_SIZE) result.push(null);
  return { line: result, gained };
}

function rotateGrid(grid: Grid): Grid {
  // rota 90° en sentido horario: next[c][GRID_SIZE-1-r] = grid[r][c]
  const next = emptyGrid();
  for (let r = 0; r < GRID_SIZE; r++) {
    const sourceRow = grid[r];
    if (!sourceRow) continue;
    for (let c = 0; c < GRID_SIZE; c++) {
      const destRow = next[c];
      if (destRow) destRow[GRID_SIZE - 1 - r] = sourceRow[c] ?? null;
    }
  }
  return next;
}

/** Aplica un movimiento completo a la grilla. rotations: cuántas veces rotar antes/después para reusar collapseLine("left") en cualquier dirección */
function move(grid: Grid, direction: Direction): { grid: Grid; gained: number; moved: boolean } {
  const rotationsIn: Record<Direction, number> = { left: 0, up: 3, right: 2, down: 1 };
  const rotations = rotationsIn[direction];

  let working = grid;
  for (let i = 0; i < rotations; i++) working = rotateGrid(working);

  let gained = 0;
  const collapsed = working.map((row) => {
    const { line, gained: g } = collapseLine(row);
    gained += g;
    return line;
  });

  let result = collapsed;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotateGrid(result);

  const moved = JSON.stringify(result) !== JSON.stringify(grid);
  return { grid: result, gained, moved };
}

/** Verifica si queda algún movimiento posible (celda vacía o fusión adyacente) */
function hasMovesLeft(grid: Grid): boolean {
  if (emptyCells(grid).length > 0) return true;
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = grid[r];
    const nextRow = grid[r + 1];
    if (!row) continue;
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = row[c];
      if (v === null || v === undefined) continue;
      if (c + 1 < GRID_SIZE && row[c + 1] === v) return true;
      if (nextRow && nextRow[c] === v) return true;
    }
  }
  return false;
}

/** Nivel más alto presente en la grilla, para mostrar el progreso hacia "¡Mordida!" */
function highestLevel(grid: Grid): number {
  let best = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell !== null && cell > best) best = cell;
    }
  }
  return best;
}

/**
 * Minijuego "Combo Perfecto" (mecánica de 2048): desliza los ingredientes
 * en una dirección; los de mismo nivel que colisionan se fusionan en el
 * siguiente nivel de la hamburguesa. Controles: flechas del teclado,
 * swipe táctil o el pad en pantalla. Termina cuando la grilla está llena
 * y no hay más fusiones posibles.
 *
 * El movimiento se calcula sobre `gridRef` y no dentro de un updater de
 * `setGrid`: React invoca los updaters durante el render (dos veces en
 * StrictMode), así que disparar `setScore`/`setState` desde ahí dentro
 * duplicaba puntos y efectos.
 */
export function ComboPerfecto() {
  const { submit, leaderboardKey, savedAs } = useScoreSubmit(GAME_SLUG);
  const [grid, setGrid] = React.useState<Grid>(emptyGrid());
  const [state, setState] = React.useState<GameState>("idle");
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [pulse, setPulse] = React.useState(0); // fuerza re-render de animación en cada movimiento
  const [gainPop, setGainPop] = React.useState<{ id: number; amount: number } | null>(null);

  const gridRef = React.useRef<Grid>(emptyGrid());
  const stateRef = React.useRef<GameState>("idle");
  const scoreRef = React.useRef(0); // el puntaje manda la dificultad, y se lee fuera del render
  const touchStart = React.useRef<{ x: number; y: number } | null>(null);
  const gainId = React.useRef(0);
  const gainTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  stateRef.current = state;

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (gainTimeout.current) clearTimeout(gainTimeout.current);
    };
  }, []);

  function startGame() {
    let g = emptyGrid();
    g = spawnTile(g);
    g = spawnTile(g);
    gridRef.current = g;
    scoreRef.current = 0;
    setGrid(g);
    setScore(0);
    setGainPop(null);
    setIsNewRecord(false);
    setState("playing");
  }

  const handleMove = React.useCallback((direction: Direction) => {
    if (stateRef.current !== "playing") return;

    const { grid: nextGrid, gained, moved } = move(gridRef.current, direction);
    if (!moved) return;

    // Dificultad: fichas cada vez más pobres y, más adelante, tandas dobles
    const currentScore = scoreRef.current;
    const lowChance = ramp(currentScore, LOW_TILE_CHANCE_FROM, LOW_TILE_CHANCE_TO, RAMP_OVER_POINTS);
    let withSpawn = spawnTile(nextGrid, lowChance);
    if (Math.random() < chanceFor(currentScore, DOUBLE_SPAWN_STARTS_AT, DOUBLE_SPAWN_MAX_CHANCE, RAMP_OVER_POINTS)) {
      withSpawn = spawnTile(withSpawn, lowChance);
    }

    gridRef.current = withSpawn;
    setGrid(withSpawn);
    setPulse((p) => p + 1);

    if (gained > 0) {
      scoreRef.current = currentScore + gained;
      setScore(scoreRef.current);
      const id = gainId.current++;
      setGainPop({ id, amount: gained });
      if (gainTimeout.current) clearTimeout(gainTimeout.current);
      gainTimeout.current = setTimeout(() => setGainPop(null), 700);
    }

    if (!hasMovesLeft(withSpawn)) setState("finished");
  }, []);

  // ── Input: flechas del teclado ──
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (state !== "playing") return;
      const map: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, handleMove]);

  // ── Input: swipe táctil ──
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current || state !== "playing") return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // swipe muy corto, ignorar

    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? "right" : "left");
    } else {
      handleMove(dy > 0 ? "down" : "up");
    }
  }

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

  const top = highestLevel(grid);
  const topLevel = LEVELS[top] ?? FALLBACK_LEVEL;
  const nextLevel = LEVELS[Math.min(top + 1, LEVELS.length - 1)] ?? FALLBACK_LEVEL;
  const reachedGoal = top >= LEVELS.length - 1;

  const mordiMood: MordiExpression =
    state === "finished" ? (isNewRecord ? "love" : "sad") : reachedGoal ? "cool" : state === "playing" ? "determined" : "happy";

  return (
    <GameLayout>
      <GameShell
        title="COMBO PERFECTO"
        subtitle="Combina ingredientes iguales para subirlos de nivel. La meta: armar la Mordida completa."
        mordi={mordiMood}
        hud={
          <>
            <GameStat icon={<Target className="h-4 w-4" />} label="Puntos" value={score} />
            <GameStat
              icon={<TrendingUp className="h-4 w-4" />}
              label="Nivel"
              value={levelFor(score, 250)}
              tone={score >= DOUBLE_SPAWN_STARTS_AT ? "ember" : "neutral"}
            />
            {bestScore > 0 && (
              <GameStat icon={<Trophy className="h-4 w-4" />} label="Récord" value={bestScore} tone="gold" />
            )}
            <GameStat
              icon={<topLevel.Icon className="h-4 w-4" />}
              label="Mejor"
              value={topLevel.label}
              tone="ember"
            />
          </>
        }
        footer={
          <div className="space-y-4">
            {state === "playing" && (
              <>
                <p className="text-center text-xs text-charcoal-500 dark:text-charcoal-300">
                  {reachedGoal ? (
                    <span className="font-semibold text-ember-500">¡Armaste la Mordida completa! Sigue sumando.</span>
                  ) : (
                    <>
                      Siguiente nivel: <span className="font-semibold text-ember-500">{nextLevel.label}</span>
                    </>
                  )}
                </p>
                {/* Pad en pantalla: en móvil el swipe funciona, pero un control
                    visible evita que el jugador tenga que adivinar el gesto. */}
                <div className="mx-auto grid w-36 grid-cols-3 grid-rows-2 gap-1.5">
                  <DirButton className="col-start-2" onPress={() => handleMove("up")} label="Arriba">
                    <ArrowUp className="h-4 w-4" />
                  </DirButton>
                  <DirButton className="col-start-1 row-start-2" onPress={() => handleMove("left")} label="Izquierda">
                    <ArrowLeft className="h-4 w-4" />
                  </DirButton>
                  <DirButton className="col-start-2 row-start-2" onPress={() => handleMove("down")} label="Abajo">
                    <ArrowDown className="h-4 w-4" />
                  </DirButton>
                  <DirButton className="col-start-3 row-start-2" onPress={() => handleMove("right")} label="Derecha">
                    <ArrowRight className="h-4 w-4" />
                  </DirButton>
                </div>
              </>
            )}

            {state === "idle" && (
              <Button onClick={startGame} size="lg" className="w-full">
                Jugar
              </Button>
            )}

            {state === "finished" && (
              <GameResult
                isNewRecord={isNewRecord}
                headline={`${score} puntos`}
                detail="¡Sin más movimientos!"
                bestLabel={bestScore > 0 ? `Tu récord personal: ${bestScore}` : undefined}
                savedAs={savedAs}
                onReplay={startGame}
              />
            )}
          </div>
        }
      >
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative mx-auto grid aspect-square w-full max-w-sm touch-none grid-cols-4 gap-2 rounded-xl p-2"
          style={{
            background: "linear-gradient(180deg,#3B2A1E 0%,#241812 60%,#181008 100%)",
            boxShadow: "inset 0 2px 12px rgba(0,0,0,0.55)",
          }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div key={`${r}-${c}`} className="relative aspect-square rounded-lg bg-black/25 ring-1 ring-white/5">
                <AnimatePresence mode="popLayout">
                  {cell !== null &&
                    (() => {
                      const level = LEVELS[cell] ?? FALLBACK_LEVEL;
                      const Icon = level.Icon;
                      const isTop = cell === LEVELS.length - 1;
                      return (
                        <motion.div
                          key={`${r}-${c}-${cell}-${pulse}`}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 26 }}
                          className={cn(
                            "absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-lg p-1 shadow-md ring-1 ring-black/15",
                            isTop && "ring-2 ring-mustard-300"
                          )}
                          style={{
                            background: `linear-gradient(155deg, ${level.from} 0%, ${level.to} 100%)`,
                            boxShadow: isTop
                              ? "0 0 18px rgba(240,169,58,0.55), inset 0 1px 0 rgba(255,255,255,0.5)"
                              : "inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 5px rgba(0,0,0,0.3)",
                          }}
                        >
                          <Icon className="h-[62%] w-[62%] drop-shadow-sm" />
                          <span className="mt-0.5 max-w-full truncate px-0.5 text-[9px] font-bold uppercase leading-none tracking-tight text-charcoal-900/70 sm:text-[10px]">
                            {level.label}
                          </span>
                        </motion.div>
                      );
                    })()}
                </AnimatePresence>
              </div>
            ))
          )}

          {/* Puntos ganados en la última fusión */}
          <AnimatePresence>
            {gainPop && (
              <motion.span
                key={gainPop.id}
                initial={{ opacity: 0, y: 10, scale: 0.7 }}
                animate={{ opacity: 1, y: -18, scale: 1.1 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="pointer-events-none absolute inset-x-0 top-1/2 z-20 text-center font-display text-3xl text-mustard-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
              >
                +{gainPop.amount}
              </motion.span>
            )}
          </AnimatePresence>

          {state === "idle" && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-xl bg-charcoal-900/60 text-cream backdrop-blur-[2px]">
              <div className="h-14 w-14">
                <MordiSprite expression="happy" glow className="h-full w-full" />
              </div>
              <p className="font-display text-base tracking-wide">Arma la Mordida completa</p>
              <p className="text-[11px] text-charcoal-200">Flechas, swipe o el pad de abajo</p>
            </div>
          )}
        </div>
      </GameShell>

      <Leaderboard game={GAME_SLUG} refreshKey={leaderboardKey} />
    </GameLayout>
  );
}

/** Botón del pad direccional en pantalla */
function DirButton({
  children,
  onPress,
  label,
  className,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className={cn(
        "flex h-10 items-center justify-center rounded-lg bg-charcoal-100 text-charcoal-600 transition-colors hover:bg-ember-500 hover:text-white active:scale-95 dark:bg-charcoal-700 dark:text-charcoal-100",
        className
      )}
    >
      {children}
    </button>
  );
}
