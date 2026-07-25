"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leaderboard } from "@/components/games/Leaderboard";
import { submitGameScoreAction } from "@/actions/games";

const GAME_SLUG = "corta-los-ingredientes";
const BEST_SCORE_KEY = "lm_game_best_corta-los-ingredientes";

const WORLD_WIDTH = 480;
const WORLD_HEIGHT = 560;

const GRAVITY = 900; // px/s²
const SPAWN_MIN_MS = 550;
const SPAWN_MAX_MS = 950;
const ITEM_RADIUS = 26;
const START_LIVES = 3;
const SLICED_FADE_MS = 250; // cuánto tiempo queda visible (desvanecido) un ítem tras cortarlo, antes de limpiarlo del estado

// Cuánto tiempo (en puntos del trazo) se conserva el rastro del cursor
// para detectar cortes — un buffer corto y no todo el historial de sesión.
const TRAIL_MAX_POINTS = 8;
const TRAIL_MAX_AGE_MS = 120;

const INGREDIENTS = [
  { emoji: "🍅", color: "#D64545" },
  { emoji: "🧀", color: "#F0C94A" },
  { emoji: "🥬", color: "#7BA05B" },
  { emoji: "🥓", color: "#C1544B" },
  { emoji: "🍞", color: "#D9A15C" },
] as const;

// INGREDIENTS nunca está vacío (literal fijo de 5 elementos definido
// arriba), así que el índice 0 siempre existe. Única aserción no-null
// del archivo, usada como fallback para cualquier índice fuera de rango.
const FALLBACK_INGREDIENT = INGREDIENTS[0]!;

type ItemKind = "ingredient" | "bomb";
type FlyingItem = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: ItemKind;
  emoji: string;
  color: string;
  sliced: boolean;
  slicedAt: number | null; // g.elapsedMs en el momento del corte, para el fade y la limpieza
  spawnedAt: number;
};
type TrailPoint = { x: number; y: number; t: number };
type RunState = "idle" | "playing" | "gameover";

type GameRefState = {
  items: FlyingItem[];
  trail: TrailPoint[];
  nextSpawnInMs: number;
  elapsedMs: number;
  lastFrame: number;
  rafId: number;
  idCounter: number;
};

/** Distancia mínima de un punto a un segmento de línea (para detectar corte) */
function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

/**
 * Minijuego "Corta los Ingredientes" (mecánica Fruit Ninja): ingredientes
 * y alguna bomba salen despedidos con trayectoria parabólica real
 * (velocidad inicial + gravedad); el jugador dibuja un trazo con el
 * dedo/mouse para "cortarlos" antes de que caigan. El corte se detecta
 * como colisión segmento-de-línea-vs-círculo entre los últimos puntos
 * del trazo y cada objeto en vuelo — no un simple click. 3 vidas: se
 * pierde una por cada ingrediente (no bomba) que cae sin cortar; cortar
 * una bomba termina la partida al instante.
 */
export function CortaLosIngredientes() {
  const { data: session } = useSession();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [runState, setRunState] = React.useState<RunState>("idle");
  const [score, setScore] = React.useState(0);
  const [lives, setLives] = React.useState(START_LIVES);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);
  const [bombHit, setBombHit] = React.useState(false);

  const gameRef = React.useRef<GameRefState>({
    items: [],
    trail: [],
    nextSpawnInMs: 400,
    elapsedMs: 0,
    lastFrame: 0,
    rafId: 0,
    idCounter: 0,
  });

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  function startGame() {
    const g = gameRef.current;
    g.items = [];
    g.trail = [];
    g.nextSpawnInMs = 400;
    g.elapsedMs = 0;
    g.lastFrame = 0;
    g.idCounter = 0;
    setScore(0);
    setLives(START_LIVES);
    setIsNewRecord(false);
    setBombHit(false);
    setRunState("playing");
  }

  function endGame(finalScore: number) {
    setRunState("gameover");
    setScore(finalScore);
  }

  function spawnItem(g: GameRefState) {
    const isBomb = Math.random() < 0.12;
    const x = 60 + Math.random() * (WORLD_WIDTH - 120);
    const vx = (Math.random() - 0.5) * 160;
    const vy = -(750 + Math.random() * 250); // impulso hacia arriba

    const ing = INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)] ?? FALLBACK_INGREDIENT;
    g.items.push({
      id: g.idCounter++,
      x,
      y: WORLD_HEIGHT + ITEM_RADIUS,
      vx,
      vy,
      radius: ITEM_RADIUS,
      kind: isBomb ? "bomb" : "ingredient",
      emoji: isBomb ? "💣" : ing.emoji,
      color: isBomb ? "#2a2a2a" : ing.color,
      sliced: false,
      slicedAt: null,
      spawnedAt: g.elapsedMs,
    });
  }

  // ── Input: rastro de puntero (mouse o touch) ──
  function addTrailPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = WORLD_WIDTH / rect.width;
    const scaleY = WORLD_HEIGHT / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const g = gameRef.current;
    g.trail.push({ x, y, t: performance.now() });
    if (g.trail.length > TRAIL_MAX_POINTS) g.trail.shift();
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (runState !== "playing") return;
    addTrailPoint(e.clientX, e.clientY);
  }
  function handlePointerDown(e: React.PointerEvent) {
    if (runState === "idle" || runState === "gameover") {
      startGame();
      return;
    }
    addTrailPoint(e.clientX, e.clientY);
  }

  // ── Loop principal ──
  React.useEffect(() => {
    if (runState !== "playing") return;

    const canvas = canvasRef.current;
    const maybeCtx = canvas?.getContext("2d");
    if (!canvas || !maybeCtx) return;
    const ctx = maybeCtx; // referencia con tipo estrecho, capturada por el closure de abajo

    const g = gameRef.current;
    let cancelled = false;
    let currentScore = 0;
    let currentLives = START_LIVES;

    function frame(t: number) {
      if (cancelled) return;
      if (!g.lastFrame) g.lastFrame = t;
      const dt = Math.min((t - g.lastFrame) / 1000, 1 / 30);
      g.lastFrame = t;
      g.elapsedMs += dt * 1000;

      // Limpia puntos viejos del rastro
      const now = performance.now();
      g.trail = g.trail.filter((p) => now - p.t < TRAIL_MAX_AGE_MS);

      // Spawns
      g.nextSpawnInMs -= dt * 1000;
      if (g.nextSpawnInMs <= 0) {
        spawnItem(g);
        g.nextSpawnInMs = SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
      }

      let hitBomb = false;

      for (const item of g.items) {
        if (item.sliced) continue;
        item.vy += GRAVITY * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;

        // Detección de corte: ¿algún segmento reciente del trazo cruza este ítem?
        for (let i = 1; i < g.trail.length; i++) {
          const a = g.trail[i - 1];
          const b = g.trail[i];
          if (!a || !b) continue;
          const dist = pointToSegmentDistance(item.x, item.y, a.x, a.y, b.x, b.y);
          if (dist < item.radius) {
            item.sliced = true;
            item.slicedAt = g.elapsedMs;
            if (item.kind === "bomb") {
              hitBomb = true;
            } else {
              currentScore += 1;
            }
            break;
          }
        }

        // Cayó fuera de la pantalla sin cortar
        if (!item.sliced && item.y - item.radius > WORLD_HEIGHT) {
          item.sliced = true;
          item.slicedAt = g.elapsedMs;
          if (item.kind === "ingredient") {
            currentLives -= 1;
          }
        }
      }

      // Un ítem se elimina del estado poco después de ser cortado/caer
      // (deja ver brevemente el fade), o si sigue en vuelo, nunca se
      // elimina por tiempo — solo por corte o por salir de pantalla.
      g.items = g.items.filter((item) => !item.sliced || g.elapsedMs - (item.slicedAt ?? 0) < SLICED_FADE_MS);

      setScore(currentScore);
      setLives(currentLives);

      if (hitBomb) {
        setBombHit(true);
        endGame(currentScore);
        return;
      }
      if (currentLives <= 0) {
        endGame(currentScore);
        return;
      }

      draw(ctx, g);
      g.rafId = requestAnimationFrame(frame);
    }

    g.rafId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(g.rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState]);

  // Récord + leaderboard
  React.useEffect(() => {
    if (runState !== "gameover") return;

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
  }, [runState]);

  // Frame estático cuando no está jugando
  React.useEffect(() => {
    if (runState === "playing") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    draw(ctx, gameRef.current);
  }, [runState]);

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[0.9fr_1fr] lg:items-start">
      <Card className="p-6 text-center">
        <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">
          CORTA LOS INGREDIENTES
        </h3>
        <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
          Desliza el dedo o el mouse para cortar los ingredientes. ¡Evita las bombas!
        </p>

        <div className="mt-4 flex items-center justify-between text-sm font-semibold text-charcoal-700 dark:text-charcoal-200">
          <span>Puntaje: {score}</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: START_LIVES }).map((_, i) => (
              <Heart
                key={i}
                className={`h-4 w-4 ${i < lives ? "fill-ember-500 text-ember-500" : "text-charcoal-200"}`}
              />
            ))}
          </div>
        </div>

        <div
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          className="relative mx-auto mt-4 max-w-sm cursor-crosshair touch-none select-none overflow-hidden rounded-2xl"
          style={{ aspectRatio: `${WORLD_WIDTH} / ${WORLD_HEIGHT}` }}
        >
          <canvas
            ref={canvasRef}
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            className="h-full w-full bg-char-gradient"
          />

          {runState !== "playing" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-charcoal-900/50 text-cream backdrop-blur-[1px]">
              {runState === "idle" && (
                <>
                  <p className="font-display text-xl tracking-wide">Toca para empezar</p>
                  <p className="text-xs text-charcoal-200">Desliza para cortar</p>
                </>
              )}
              {runState === "gameover" && (
                <>
                  {bombHit && <p className="text-sm font-semibold text-red-400">¡Cortaste una bomba!</p>}
                  {isNewRecord && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mustard-400/20 px-3 py-1 text-xs font-bold text-mustard-300">
                      <Sparkles className="h-3.5 w-3.5" /> ¡NUEVO RÉCORD!
                    </span>
                  )}
                  <p className="font-display text-2xl tracking-wide">{score} cortes</p>
                  {!isNewRecord && bestScore > 0 && (
                    <p className="text-xs text-charcoal-300">Tu récord: {bestScore}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-6">
          {runState === "idle" && (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )}
          {runState === "gameover" && (
            <div className="space-y-3">
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

/** Dibuja un frame completo: fondo, ítems en vuelo y rastro del cursor */
function draw(ctx: CanvasRenderingContext2D, g: GameRefState) {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Fondo ambiental simple
  ctx.fillStyle = "rgba(232,92,43,0.06)";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Ítems en vuelo
  for (const item of g.items) {
    ctx.save();
    ctx.globalAlpha = item.sliced ? 0.25 : 1;
    ctx.translate(item.x, item.y);
    ctx.font = `${item.radius * 1.6}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.emoji, 0, 0);
    ctx.restore();
  }

  // Rastro del cursor (estela)
  if (g.trail.length > 1) {
    const first = g.trail[0];
    if (first) {
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < g.trail.length; i++) {
        const p = g.trail[i];
        if (p) ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }
}
