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

const GAME_SLUG = "combo-perfecto";
const BEST_SCORE_KEY = "lm_game_best_combo-perfecto";

const GRID_SIZE = 4;

// Niveles del ingrediente, en orden de fusión: 2 "Pan" se fusionan en 1
// "Pan doble", 2 "Pan doble" en "Carne", etc. — hasta llegar a la
// hamburguesa completa (nivel máximo), que es la "meta" visual del juego.
const LEVELS = [
  { label: "Pan", emoji: "🥖", color: "#E8C989" },
  { label: "Pan x2", emoji: "🍞", color: "#D9A15C" },
  { label: "Queso", emoji: "🧀", color: "#F0C94A" },
  { label: "Tomate", emoji: "🍅", color: "#D64545" },
  { label: "Lechuga", emoji: "🥬", color: "#7BA05B" },
  { label: "Carne", emoji: "🥩", color: "#6B3A2A" },
  { label: "Tocino", emoji: "🥓", color: "#C1544B" },
  { label: "¡Mordida!", emoji: "🍔", color: "#E85C2B" },
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

/** Coloca una ficha nueva (90% nivel 0, 10% nivel 1) en una celda vacía aleatoria */
function spawnTile(grid: Grid): Grid {
  const empties = emptyCells(grid);
  if (empties.length === 0) return grid;
  const target = empties[Math.floor(Math.random() * empties.length)];
  if (!target) return grid;
  const [r, c] = target;
  const next = cloneGrid(grid);
  const row = next[r];
  if (row) row[c] = Math.random() < 0.9 ? 0 : 1;
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

/**
 * Minijuego "Combo Perfecto" (mecánica de 2048): desliza los ingredientes
 * en una dirección; los de mismo nivel que colisionan se fusionan en el
 * siguiente nivel de la hamburguesa. Controles: flechas del teclado o
 * swipe táctil. Termina cuando la grilla está llena y no hay más
 * fusiones posibles. Mecánica ya probada como una de las más adictivas
 * en juegos casuales — aquí con la temática de ingredientes de la marca.
 */
export function ComboPerfecto() {
  const { data: session } = useSession();
  const [grid, setGrid] = React.useState<Grid>(emptyGrid());
  const [state, setState] = React.useState<GameState>("idle");
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);
  const [pulse, setPulse] = React.useState(0); // fuerza re-render de animación en cada movimiento

  const touchStart = React.useRef<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  function startGame() {
    let g = emptyGrid();
    g = spawnTile(g);
    g = spawnTile(g);
    setGrid(g);
    setScore(0);
    setIsNewRecord(false);
    setState("playing");
  }

  const handleMove = React.useCallback(
    (direction: Direction) => {
      setGrid((current) => {
        const { grid: nextGrid, gained, moved } = move(current, direction);
        if (!moved) return current;

        const withSpawn = spawnTile(nextGrid);
        setScore((s) => s + gained);
        setPulse((p) => p + 1);

        if (!hasMovesLeft(withSpawn)) {
          setState("finished");
        }

        return withSpawn;
      });
    },
    []
  );

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
        <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">COMBO PERFECTO</h3>
        <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
          Desliza (flechas o swipe) para combinar ingredientes iguales y armar la hamburguesa completa.
        </p>

        <div className="mt-4 flex items-center justify-between text-sm font-semibold text-charcoal-700 dark:text-charcoal-200">
          <span>Puntaje: {score}</span>
          {bestScore > 0 && <span className="text-charcoal-400">Récord: {bestScore}</span>}
        </div>

        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="relative mx-auto mt-4 grid aspect-square w-full max-w-sm touch-none grid-cols-4 gap-2 rounded-2xl bg-charcoal-100 p-2 dark:bg-charcoal-900/50"
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className="relative aspect-square rounded-lg bg-charcoal-50/60 dark:bg-charcoal-800/40"
              >
                <AnimatePresence mode="popLayout">
                  {cell !== null && (() => {
                    const level = LEVELS[cell] ?? FALLBACK_LEVEL;
                    return (
                      <motion.div
                        key={`${r}-${c}-${cell}-${pulse}`}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 26 }}
                        className="absolute inset-0 flex flex-col items-center justify-center rounded-lg text-white shadow-sm"
                        style={{ backgroundColor: level.color }}
                      >
                        <span className="text-lg leading-none sm:text-xl">{level.emoji}</span>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            ))
          )}

          {state === "idle" && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-charcoal-900/40 text-sm text-cream backdrop-blur-[1px]">
              Presiona &quot;Jugar&quot; para empezar
            </div>
          )}
        </div>

        <div className="mt-6">
          {state === "idle" && (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )}

          {state === "playing" && (
            <p className="text-xs text-charcoal-400">Usa las flechas del teclado o desliza en la grilla</p>
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
                    ¡Sin más movimientos! {score} puntos
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
