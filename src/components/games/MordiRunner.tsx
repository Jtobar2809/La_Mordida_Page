"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leaderboard } from "@/components/games/Leaderboard";
import { submitGameScoreAction } from "@/actions/games";

const GAME_SLUG = "mordi-runner";
const BEST_SCORE_KEY = "lm_game_best_mordi-runner";

// ── Geometría del mundo del juego (coordenadas lógicas, no de pantalla) ──
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 320;
const GROUND_Y = 260;

const MORDI_SIZE = 56;
const MORDI_X = 90;

const GRAVITY = 2200; // px/s²
const JUMP_VELOCITY = -760; // px/s

const OBSTACLE_MIN_GAP_MS = 900;
const OBSTACLE_MAX_GAP_MS = 1600;
const OBSTACLE_SIZE = 34;

const BASE_SPEED = 320; // px/s
const MAX_SPEED = 620;
const SPEED_RAMP_PER_MS = 0.012; // cuánto sube la velocidad por ms transcurrido

type Obstacle = { x: number; passed: boolean };

type RunState = "idle" | "playing" | "gameover";

/** Estado mutable del juego que vive fuera del ciclo de render de React */
type GameRefState = {
  mordiY: number;
  velocityY: number;
  onGround: boolean;
  obstacles: Obstacle[];
  nextObstacleInMs: number;
  elapsedMs: number;
  lastFrame: number;
  rafId: number;
  groundOffset: number;
  bgOffset: number;
};

/**
 * Minijuego "Mordi Runner": Mordi corre automáticamente sobre el suelo y
 * el jugador salta obstáculos con un solo control (tap/click/espacio).
 * Usa Canvas 2D con requestAnimationFrame — el único de los 10 juegos
 * que necesita un loop de render real — pero se mantiene liviano:
 * colisión por bounding-box (sin motor de física), parallax de 2 capas
 * dibujado con rectángulos/formas simples (sin sprite-sheets ni assets
 * adicionales), y física de salto minimalista (gravedad + velocidad).
 */
export function MordiRunner() {
  const { data: session } = useSession();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [runState, setRunState] = React.useState<RunState>("idle");
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);

  // Estado del juego que vive fuera de React (el loop de render no debe
  // esperar a los ciclos de commit de React — se lee/escribe directo en
  // refs y solo se sincroniza a React state para la UI de puntaje/fin).
  const gameRef = React.useRef<GameRefState>({
    mordiY: GROUND_Y - MORDI_SIZE,
    velocityY: 0,
    onGround: true,
    obstacles: [] as Obstacle[],
    nextObstacleInMs: 1000,
    elapsedMs: 0,
    lastFrame: 0,
    rafId: 0,
    groundOffset: 0,
    bgOffset: 0,
  });

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  const jump = React.useCallback(() => {
    const g = gameRef.current;
    if (runState === "playing" && g.onGround) {
      g.velocityY = JUMP_VELOCITY;
      g.onGround = false;
    }
  }, [runState]);

  function startGame() {
    const g = gameRef.current;
    g.mordiY = GROUND_Y - MORDI_SIZE;
    g.velocityY = 0;
    g.onGround = true;
    g.obstacles = [];
    g.nextObstacleInMs = 1000;
    g.elapsedMs = 0;
    g.lastFrame = 0;
    g.groundOffset = 0;
    g.bgOffset = 0;
    setScore(0);
    setIsNewRecord(false);
    setRunState("playing");
  }

  function endGame(finalScore: number) {
    setRunState("gameover");
    setScore(finalScore);
  }

  // ── Input: click/tap en el canvas + barra espaciadora ──
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        if (runState === "idle" || runState === "gameover") startGame();
        else jump();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState, jump]);

  function handlePointerDown() {
    if (runState === "idle" || runState === "gameover") {
      startGame();
    } else {
      jump();
    }
  }

  // ── Loop principal de render/física ──
  React.useEffect(() => {
    if (runState !== "playing") return;

    const canvas = canvasRef.current;
    const maybeCtx = canvas?.getContext("2d");
    if (!canvas || !maybeCtx) return;
    const ctx = maybeCtx; // referencia con tipo estrecho, capturada por el closure de abajo

    const g = gameRef.current;
    let cancelled = false;
    let currentScore = 0;

    function frame(t: number) {
      if (cancelled) return;
      if (!g.lastFrame) g.lastFrame = t;
      const dt = Math.min((t - g.lastFrame) / 1000, 1 / 30); // clamp: evita saltos si la pestaña pierde foco
      g.lastFrame = t;
      g.elapsedMs += dt * 1000;

      const speed = Math.min(BASE_SPEED + g.elapsedMs * SPEED_RAMP_PER_MS, MAX_SPEED);

      // Física del salto
      g.velocityY += GRAVITY * dt;
      g.mordiY += g.velocityY * dt;
      const floorY = GROUND_Y - MORDI_SIZE;
      if (g.mordiY >= floorY) {
        g.mordiY = floorY;
        g.velocityY = 0;
        g.onGround = true;
      }

      // Parallax
      g.groundOffset = (g.groundOffset + speed * dt) % 40;
      g.bgOffset = (g.bgOffset + speed * dt * 0.35) % 160;

      // Spawn de obstáculos
      g.nextObstacleInMs -= dt * 1000;
      if (g.nextObstacleInMs <= 0) {
        g.obstacles.push({ x: WORLD_WIDTH + 20, passed: false });
        g.nextObstacleInMs = OBSTACLE_MIN_GAP_MS + Math.random() * (OBSTACLE_MAX_GAP_MS - OBSTACLE_MIN_GAP_MS);
      }

      // Mover obstáculos + detectar puntaje + colisión
      const mordiBox = {
        x: MORDI_X + 8,
        y: g.mordiY + 8,
        w: MORDI_SIZE - 16,
        h: MORDI_SIZE - 16,
      };

      let collided = false;
      for (const ob of g.obstacles) {
        ob.x -= speed * dt;
        if (!ob.passed && ob.x + OBSTACLE_SIZE < MORDI_X) {
          ob.passed = true;
          currentScore += 1;
        }
        const obBox = { x: ob.x + 4, y: GROUND_Y - OBSTACLE_SIZE + 4, w: OBSTACLE_SIZE - 8, h: OBSTACLE_SIZE - 8 };
        if (
          mordiBox.x < obBox.x + obBox.w &&
          mordiBox.x + mordiBox.w > obBox.x &&
          mordiBox.y < obBox.y + obBox.h &&
          mordiBox.y + mordiBox.h > obBox.y
        ) {
          collided = true;
        }
      }
      g.obstacles = g.obstacles.filter((ob) => ob.x > -OBSTACLE_SIZE);

      setScore(currentScore);

      if (collided) {
        endGame(currentScore);
        return;
      }

      draw(ctx, g, currentScore);
      g.rafId = requestAnimationFrame(frame);
    }

    g.rafId = requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      cancelAnimationFrame(g.rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState]);

  // Al terminar: récord + leaderboard
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

  // Dibuja el estado inicial/estático cuando no está jugando
  React.useEffect(() => {
    if (runState === "playing") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    draw(ctx, gameRef.current, score);
  }, [runState, score]);

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <Card className="p-6 text-center">
        <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">MORDI RUNNER</h3>
        <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
          Salta las parrillas con un click, tap o espacio. ¡Va acelerando!
        </p>

        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          className="relative mt-4 w-full cursor-pointer touch-none select-none overflow-hidden rounded-2xl"
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
                  <p className="text-xs text-charcoal-200">Espacio, click o tap para saltar</p>
                </>
              )}
              {runState === "gameover" && (
                <>
                  {isNewRecord && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mustard-400/20 px-3 py-1 text-xs font-bold text-mustard-300">
                      <Sparkles className="h-3.5 w-3.5" /> ¡NUEVO RÉCORD!
                    </span>
                  )}
                  <p className="font-display text-2xl tracking-wide">{score} obstáculos</p>
                  {!isNewRecord && bestScore > 0 && (
                    <p className="text-xs text-charcoal-300">Tu récord: {bestScore}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-sm font-semibold text-charcoal-700 dark:text-charcoal-200">
          <span>Puntaje: {score}</span>
          {bestScore > 0 && <span className="text-charcoal-400">Récord: {bestScore}</span>}
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

/** Dibuja un frame completo: fondo con parallax, suelo, Mordi y obstáculos */
function draw(ctx: CanvasRenderingContext2D, g: GameRefState, score: number) {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Fondo: colinas lejanas simples (parallax lento)
  ctx.fillStyle = "rgba(232,92,43,0.12)";
  for (let i = -1; i < 6; i++) {
    const x = i * 160 - g.bgOffset;
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y - 10, 90, 40, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Suelo
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 14]);
  ctx.lineDashOffset = -g.groundOffset;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(WORLD_WIDTH, GROUND_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Obstáculos ("parrillas": rejilla + brasa)
  for (const ob of g.obstacles) {
    const x = ob.x;
    const y = GROUND_Y - OBSTACLE_SIZE;
    ctx.fillStyle = "#3a2e28";
    ctx.fillRect(x, y, OBSTACLE_SIZE, OBSTACLE_SIZE);
    ctx.fillStyle = "#E85C2B";
    for (let bar = 0; bar < 3; bar++) {
      ctx.fillRect(x + 4, y + 6 + bar * 9, OBSTACLE_SIZE - 8, 3);
    }
  }

  // Mordi (bounce sutil basado en si está en el suelo)
  const bounce = g.onGround ? Math.sin(g.elapsedMs / 90) * 3 : 0;
  ctx.save();
  ctx.translate(MORDI_X + MORDI_SIZE / 2, g.mordiY + MORDI_SIZE / 2 + bounce);
  const tilt = g.onGround ? 0 : Math.max(-0.25, Math.min(0.25, g.velocityY / 3000));
  ctx.rotate(tilt);
  ctx.fillStyle = "#F0A93A";
  ctx.beginPath();
  ctx.roundRect(-MORDI_SIZE / 2, -MORDI_SIZE / 2, MORDI_SIZE, MORDI_SIZE, 14);
  ctx.fill();
  ctx.fillStyle = "#1c1512";
  ctx.beginPath();
  ctx.arc(-8, -6, 4, 0, Math.PI * 2);
  ctx.arc(10, -6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Puntaje en canvas (respaldo visual, además del contador React de abajo)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "600 20px monospace";
  ctx.fillText(String(score), 16, 32);
}
