"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Leaderboard } from "@/components/games/Leaderboard";
import { submitGameScoreAction } from "@/actions/games";

const GAME_SLUG = "salta-la-parrilla";
const BEST_SCORE_KEY = "lm_game_best_salta-la-parrilla";

// ── Geometría del mundo (coordenadas lógicas, no de pantalla) ──
const WORLD_WIDTH = 480;
const WORLD_HEIGHT = 640;

const MORDI_SIZE = 40;
const MORDI_X = 110;

const GRAVITY = 1500; // px/s² — cae cuando no se presiona
const HOLD_ACCEL = -3200; // px/s² — fuerza de ascenso mientras se mantiene presionado
const MAX_FALL_SPEED = 620;
const MAX_RISE_SPEED = -520;

const PIPE_WIDTH = 62;
const PIPE_GAP = 190; // hueco vertical entre la parrilla de arriba y la de abajo
const PIPE_MIN_MARGIN = 70; // distancia mínima del hueco al borde superior/inferior
const PIPE_SPACING_MS = 1500; // tiempo entre parrillas nuevas
const PIPE_SPEED = 190; // px/s, constante (a diferencia de Runner, aquí no acelera — mantiene el ritmo predecible clave del género)

type Pipe = { x: number; gapY: number; passed: boolean };
type RunState = "idle" | "playing" | "gameover";

type GameRefState = {
  mordiY: number;
  velocityY: number;
  pipes: Pipe[];
  nextPipeInMs: number;
  elapsedMs: number;
  lastFrame: number;
  rafId: number;
  holding: boolean;
};

/**
 * Minijuego "Salta la Parrilla" (mecánica Flappy Bird): mantén presionado
 * para que Mordi ascienda, suelta para que caiga por gravedad. Esquiva
 * pares de parrillas con un hueco. Reutiliza el mismo patrón de Canvas +
 * requestAnimationFrame que Mordi Runner, pero con física continua
 * (aceleración mientras se mantiene presionado) en vez de saltos
 * discretos, y velocidad de desplazamiento constante — el ritmo
 * predecible es justamente lo que hace adictivo a este género.
 */
export function SaltaLaParrilla() {
  const { data: session } = useSession();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const [runState, setRunState] = React.useState<RunState>("idle");
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);

  const gameRef = React.useRef<GameRefState>({
    mordiY: WORLD_HEIGHT / 2,
    velocityY: 0,
    pipes: [],
    nextPipeInMs: 800,
    elapsedMs: 0,
    lastFrame: 0,
    rafId: 0,
    holding: false,
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
    g.mordiY = WORLD_HEIGHT / 2;
    g.velocityY = 0;
    g.pipes = [];
    g.nextPipeInMs = 800;
    g.elapsedMs = 0;
    g.lastFrame = 0;
    g.holding = false;
    setScore(0);
    setIsNewRecord(false);
    setRunState("playing");
  }

  function endGame(finalScore: number) {
    setRunState("gameover");
    setScore(finalScore);
  }

  // ── Input: mantener presionado (mouse/touch) + barra espaciadora ──
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (runState === "idle" || runState === "gameover") {
        startGame();
      } else {
        gameRef.current.holding = true;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") gameRef.current.holding = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState]);

  function handlePointerDown() {
    if (runState === "idle" || runState === "gameover") {
      startGame();
    } else {
      gameRef.current.holding = true;
    }
  }
  function handlePointerUp() {
    gameRef.current.holding = false;
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

    function frame(t: number) {
      if (cancelled) return;
      if (!g.lastFrame) g.lastFrame = t;
      const dt = Math.min((t - g.lastFrame) / 1000, 1 / 30);
      g.lastFrame = t;
      g.elapsedMs += dt * 1000;

      // Física: gravedad siempre, más aceleración de ascenso si está presionado
      const accel = GRAVITY + (g.holding ? HOLD_ACCEL : 0);
      g.velocityY = Math.max(MAX_RISE_SPEED, Math.min(MAX_FALL_SPEED, g.velocityY + accel * dt));
      g.mordiY += g.velocityY * dt;

      // Techo y suelo: chocar con cualquiera termina la partida
      const hitBounds = g.mordiY - MORDI_SIZE / 2 < 0 || g.mordiY + MORDI_SIZE / 2 > WORLD_HEIGHT;

      // Spawn de parrillas
      g.nextPipeInMs -= dt * 1000;
      if (g.nextPipeInMs <= 0) {
        const gapY = PIPE_MIN_MARGIN + Math.random() * (WORLD_HEIGHT - 2 * PIPE_MIN_MARGIN - PIPE_GAP) + PIPE_GAP / 2;
        g.pipes.push({ x: WORLD_WIDTH + PIPE_WIDTH, gapY, passed: false });
        g.nextPipeInMs = PIPE_SPACING_MS;
      }

      const mordiBox = {
        x: MORDI_X - MORDI_SIZE / 2 + 6,
        y: g.mordiY - MORDI_SIZE / 2 + 6,
        w: MORDI_SIZE - 12,
        h: MORDI_SIZE - 12,
      };

      let collided = hitBounds;
      for (const pipe of g.pipes) {
        pipe.x -= PIPE_SPEED * dt;
        if (!pipe.passed && pipe.x + PIPE_WIDTH < MORDI_X) {
          pipe.passed = true;
          currentScore += 1;
        }

        const topPipeBottom = pipe.gapY - PIPE_GAP / 2;
        const bottomPipeTop = pipe.gapY + PIPE_GAP / 2;
        const overlapsX = mordiBox.x < pipe.x + PIPE_WIDTH && mordiBox.x + mordiBox.w > pipe.x;
        if (overlapsX) {
          const hitsTopPipe = mordiBox.y < topPipeBottom;
          const hitsBottomPipe = mordiBox.y + mordiBox.h > bottomPipeTop;
          if (hitsTopPipe || hitsBottomPipe) collided = true;
        }
      }
      g.pipes = g.pipes.filter((p) => p.x > -PIPE_WIDTH);

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
    draw(ctx, gameRef.current, score);
  }, [runState, score]);

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1fr] lg:items-start">
      <Card className="p-6 text-center">
        <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">SALTA LA PARRILLA</h3>
        <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
          Mantén presionado (o espacio) para subir, suelta para bajar. Esquiva las parrillas.
        </p>

        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative mx-auto mt-4 max-w-xs cursor-pointer touch-none select-none overflow-hidden rounded-2xl"
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
                  <p className="text-xs text-charcoal-200">Mantén presionado para volar</p>
                </>
              )}
              {runState === "gameover" && (
                <>
                  {isNewRecord && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-mustard-400/20 px-3 py-1 text-xs font-bold text-mustard-300">
                      <Sparkles className="h-3.5 w-3.5" /> ¡NUEVO RÉCORD!
                    </span>
                  )}
                  <p className="font-display text-2xl tracking-wide">{score} parrillas</p>
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

/** Dibuja un frame completo: fondo, parrillas (tubos) y Mordi */
function draw(ctx: CanvasRenderingContext2D, g: GameRefState, score: number) {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Fondo con gradiente vertical + viñeta
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#2c1c14");
  sky.addColorStop(1, "#1c130e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Brasas difusas ambientales, con resplandor real (no solo círculos planos)
  for (let i = 0; i < 5; i++) {
    const bx = 60 + i * 90;
    const by = 80 + (i % 2) * 40;
    const emberGlow = ctx.createRadialGradient(bx, by, 0, bx, by, 34);
    emberGlow.addColorStop(0, "rgba(232,92,43,0.22)");
    emberGlow.addColorStop(1, "rgba(232,92,43,0)");
    ctx.fillStyle = emberGlow;
    ctx.beginPath();
    ctx.arc(bx, by, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  // Parrillas (tubos) con hueco
  for (const pipe of g.pipes) {
    drawPipe(ctx, pipe.x, pipe.gapY);
  }

  // Mordi
  drawMordiFlyer(ctx, g);

  // Viñeta sutil en los bordes para dar profundidad
  const vignette = ctx.createRadialGradient(
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2,
    WORLD_HEIGHT * 0.3,
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2,
    WORLD_HEIGHT * 0.75
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Puntaje
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillText(String(score), WORLD_WIDTH / 2 + 1, 45);
  ctx.fillStyle = "#FBF6EE";
  ctx.fillText(String(score), WORLD_WIDTH / 2, 44);
}

/** Par de tubos-parrilla con hueco central: rejilla, tapa metálica y sombra de profundidad */
function drawPipe(ctx: CanvasRenderingContext2D, x: number, gapY: number) {
  const topHeight = gapY - PIPE_GAP / 2;
  const bottomY = gapY + PIPE_GAP / 2;

  const bodyGrad = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  bodyGrad.addColorStop(0, "#2a1f1a");
  bodyGrad.addColorStop(0.5, "#4a382f");
  bodyGrad.addColorStop(1, "#2a1f1a");

  // Tramo superior
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(x, 0, PIPE_WIDTH, topHeight);
  // Tramo inferior
  ctx.fillRect(x, bottomY, PIPE_WIDTH, WORLD_HEIGHT - bottomY);

  // Tapas metálicas en el borde del hueco (le dan grosor/profundidad al tubo)
  ctx.fillStyle = "#5a4436";
  ctx.fillRect(x - 4, topHeight - 14, PIPE_WIDTH + 8, 14);
  ctx.fillRect(x - 4, bottomY, PIPE_WIDTH + 8, 14);
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 4, topHeight - 14, PIPE_WIDTH + 8, 14);
  ctx.strokeRect(x - 4, bottomY, PIPE_WIDTH + 8, 14);

  // Rejilla (barras horizontales brillantes) en ambos tramos
  ctx.fillStyle = "#E85C2B";
  for (let bar = 0; bar < Math.floor(topHeight / 22); bar++) {
    ctx.fillRect(x + 6, 10 + bar * 22, PIPE_WIDTH - 12, 3);
  }
  for (let bar = 0; bar < Math.floor((WORLD_HEIGHT - bottomY - 14) / 22); bar++) {
    ctx.fillRect(x + 6, bottomY + 20 + bar * 22, PIPE_WIDTH - 12, 3);
  }
}

/** Dibuja a Mordi volando: mismo diseño de cara que Mordi Runner, con giro según velocidad vertical */
function drawMordiFlyer(ctx: CanvasRenderingContext2D, g: GameRefState) {
  ctx.save();
  ctx.translate(MORDI_X, g.mordiY);
  const tilt = Math.max(-0.4, Math.min(0.5, g.velocityY / 700));
  ctx.rotate(tilt);

  const r = MORDI_SIZE / 2;

  // Cuerpo (forma de pan, igual estilo que Mordi Runner para consistencia visual)
  const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r * 1.3);
  bodyGrad.addColorStop(0, "#F5BE5C");
  bodyGrad.addColorStop(1, "#DE8A1B");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.5);
  ctx.quadraticCurveTo(-r, -r, 0, -r);
  ctx.quadraticCurveTo(r, -r, r, r * 0.5);
  ctx.quadraticCurveTo(r, r, 0, r);
  ctx.quadraticCurveTo(-r, r, -r, r * 0.5);
  ctx.closePath();
  ctx.fill();

  // Semíllas de sésamo
  ctx.fillStyle = "rgba(255,246,232,0.85)";
  const seeds: [number, number][] = [
    [-r * 0.35, -r * 0.55],
    [0, -r * 0.7],
    [r * 0.35, -r * 0.55],
  ];
  seeds.forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.ellipse(sx, sy, 1.6, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Mejillas
  ctx.fillStyle = "rgba(232,92,43,0.35)";
  ctx.beginPath();
  ctx.arc(-r * 0.55, r * 0.05, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.55, r * 0.05, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Ojos grandes y alerta (siempre en modo "vuelo", más abiertos que en Runner)
  ctx.fillStyle = "#1B1712";
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.05, 4.2, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.05, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FBF6EE";
  ctx.beginPath();
  ctx.arc(-r * 0.28 + 1.4, -r * 0.05 - 1.4, 1.3, 0, Math.PI * 2);
  ctx.arc(r * 0.28 + 1.4, -r * 0.05 - 1.4, 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Boca pequeña y redonda (sorpresa constante del vuelo)
  ctx.strokeStyle = "#1B1712";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.38, r * 0.14, r * 0.11, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
