"use client";

import * as React from "react";
import { Flame, Trophy, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/games/Leaderboard";
import { type MordiExpression } from "@/components/games/MordiSprite";
import { GameLayout, GameOverlay, GameResult, GameShell, GameStat } from "@/components/games/GameShell";
import { beginFrame, useHiDpiCanvas } from "@/components/games/canvas-utils";
import { useScoreSubmit } from "@/components/games/useScoreSubmit";
import { levelFor, ramp } from "@/components/games/difficulty";

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
const PIPE_MIN_MARGIN = 70; // distancia mínima del hueco al borde superior/inferior

// ── Dificultad progresiva ──
// El género vive del ritmo predecible, así que la escalada es lenta y
// sin sorpresas: el hueco se estrecha, las parrillas llegan más seguidas
// y el desplazamiento acelera un poco, todo en función de cuántas
// parrillas llevas pasadas. Cada parrilla guarda el hueco con el que
// nació, para que estrecharlo no encoja retroactivamente las que ya
// están en pantalla.
const RAMP_OVER_PIPES = 25;
const GAP_FROM = 200;
const GAP_TO = 142;
const SPACING_FROM = 1500; // ms entre parrillas
const SPACING_TO = 1020;
const SPEED_FROM = 185; // px/s
const SPEED_TO = 268;

const MAX_SPARKS = 30;

type Pipe = { x: number; gapY: number; gap: number; passed: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; r: number; life: number };
type RunState = "idle" | "playing" | "gameover";

type GameRefState = {
  mordiY: number;
  velocityY: number;
  pipes: Pipe[];
  sparks: Spark[];
  nextPipeInMs: number;
  elapsedMs: number;
  lastFrame: number;
  rafId: number;
  holding: boolean;
  scoreFlash: number; // 0..1, destello al pasar una parrilla
};

function initialState(): GameRefState {
  return {
    mordiY: WORLD_HEIGHT / 2,
    velocityY: 0,
    pipes: [],
    sparks: [],
    nextPipeInMs: 800,
    elapsedMs: 0,
    lastFrame: 0,
    rafId: 0,
    holding: false,
    scoreFlash: 0,
  };
}

/**
 * Minijuego "Salta la Parrilla" (mecánica Flappy Bird): mantén presionado
 * para que Mordi ascienda, suelta para que caiga por gravedad. Esquiva
 * pares de parrillas con un hueco. Reutiliza el mismo patrón de Canvas +
 * requestAnimationFrame que Mordi Runner, pero con física continua
 * (aceleración mientras se mantiene presionado) en vez de saltos
 * discretos, y velocidad de desplazamiento constante — el ritmo
 * predecible es justamente lo que hace adictivo a este género.
 *
 * v2: buffer escalado al devicePixelRatio, parrillas con brasas y humo
 * en vez de tubos planos, estela de chispas mientras Mordi sube, y
 * sincronización del puntaje a React solo cuando cambia (antes se hacía
 * un setState por frame).
 */
export function SaltaLaParrilla() {
  const { submit, leaderboardKey, savedAs } = useScoreSubmit(GAME_SLUG);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dprRef = useHiDpiCanvas(canvasRef, WORLD_WIDTH, WORLD_HEIGHT);

  const [runState, setRunState] = React.useState<RunState>("idle");
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);

  const gameRef = React.useRef<GameRefState>(initialState());

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  function startGame() {
    gameRef.current = initialState();
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
    let renderedScore = -1;

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

      // Chispas del "impulso" mientras sube
      if (g.holding && g.sparks.length < MAX_SPARKS) {
        g.sparks.push({
          x: MORDI_X - 6 + (Math.random() - 0.5) * 10,
          y: g.mordiY + MORDI_SIZE / 2 - 4,
          vx: -40 - Math.random() * 60,
          vy: 40 + Math.random() * 80,
          r: 1.2 + Math.random() * 2,
          life: 0.35 + Math.random() * 0.3,
        });
      }
      for (const s of g.sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
      }
      g.sparks = g.sparks.filter((s) => s.life > 0);
      g.scoreFlash = Math.max(0, g.scoreFlash - dt * 2.5);

      // Techo y suelo: chocar con cualquiera termina la partida
      const hitBounds = g.mordiY - MORDI_SIZE / 2 < 0 || g.mordiY + MORDI_SIZE / 2 > WORLD_HEIGHT;

      // Spawn de parrillas, con hueco y cadencia escalados por el puntaje
      const speed = ramp(currentScore, SPEED_FROM, SPEED_TO, RAMP_OVER_PIPES);
      g.nextPipeInMs -= dt * 1000;
      if (g.nextPipeInMs <= 0) {
        const gap = ramp(currentScore, GAP_FROM, GAP_TO, RAMP_OVER_PIPES);
        const gapY = PIPE_MIN_MARGIN + Math.random() * (WORLD_HEIGHT - 2 * PIPE_MIN_MARGIN - gap) + gap / 2;
        g.pipes.push({ x: WORLD_WIDTH + PIPE_WIDTH, gapY, gap, passed: false });
        g.nextPipeInMs = ramp(currentScore, SPACING_FROM, SPACING_TO, RAMP_OVER_PIPES);
      }

      const mordiBox = {
        x: MORDI_X - MORDI_SIZE / 2 + 6,
        y: g.mordiY - MORDI_SIZE / 2 + 6,
        w: MORDI_SIZE - 12,
        h: MORDI_SIZE - 12,
      };

      let collided = hitBounds;
      for (const pipe of g.pipes) {
        pipe.x -= speed * dt;
        if (!pipe.passed && pipe.x + PIPE_WIDTH < MORDI_X) {
          pipe.passed = true;
          currentScore += 1;
          g.scoreFlash = 1;
        }

        const topPipeBottom = pipe.gapY - pipe.gap / 2;
        const bottomPipeTop = pipe.gapY + pipe.gap / 2;
        const overlapsX = mordiBox.x < pipe.x + PIPE_WIDTH && mordiBox.x + mordiBox.w > pipe.x;
        if (overlapsX) {
          const hitsTopPipe = mordiBox.y < topPipeBottom;
          const hitsBottomPipe = mordiBox.y + mordiBox.h > bottomPipeTop;
          if (hitsTopPipe || hitsBottomPipe) collided = true;
        }
      }
      g.pipes = g.pipes.filter((p) => p.x > -PIPE_WIDTH);

      if (currentScore !== renderedScore) {
        renderedScore = currentScore;
        setScore(currentScore);
      }

      if (collided) {
        endGame(currentScore);
        return;
      }

      draw(ctx, g, currentScore, dprRef.current);
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

    submit(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState]);

  // Frame estático cuando no está jugando
  React.useEffect(() => {
    if (runState === "playing") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    draw(ctx, gameRef.current, score, dprRef.current);
  }, [runState, score, dprRef]);

  const mordiMood: MordiExpression =
    runState === "gameover" ? (isNewRecord ? "love" : "dizzy") : runState === "playing" ? "surprised" : "happy";

  return (
    <GameLayout wide>
      <GameShell
        title="SALTA LA PARRILLA"
        subtitle="Mantén presionado (o espacio) para que Mordi suba, suelta para que baje. Esquiva las parrillas encendidas."
        mordi={mordiMood}
        bareBoard
        hud={
          <>
            <GameStat icon={<Flame className="h-4 w-4" />} label="Parrillas" value={score} />
            <GameStat
              icon={<TrendingUp className="h-4 w-4" />}
              label="Nivel"
              value={levelFor(score, 4)}
              tone={score >= 12 ? "ember" : "neutral"}
            />
            {bestScore > 0 && (
              <GameStat icon={<Trophy className="h-4 w-4" />} label="Récord" value={bestScore} tone="gold" />
            )}
          </>
        }
        footer={
          runState === "gameover" ? (
            <GameResult
              isNewRecord={isNewRecord}
              headline={`${score} ${score === 1 ? "parrilla" : "parrillas"}`}
              bestLabel={bestScore > 0 ? `Tu récord personal: ${bestScore}` : undefined}
              savedAs={savedAs}
              onReplay={startGame}
            />
          ) : runState === "idle" ? (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          ) : (
            <p className="text-center text-sm text-charcoal-500 dark:text-charcoal-300">
              Mantén presionado para volar
            </p>
          )
        }
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="relative mx-auto w-full max-w-[280px] cursor-pointer touch-none select-none overflow-hidden rounded-2xl"
          style={{ aspectRatio: `${WORLD_WIDTH} / ${WORLD_HEIGHT}` }}
        >
          <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} className="block h-full w-full" />

          {runState !== "playing" && (
            <GameOverlay mordi={runState === "gameover" ? (isNewRecord ? "love" : "dizzy") : "happy"}>
              {runState === "idle" ? (
                <>
                  <p className="font-display text-xl tracking-wide">Toca para empezar</p>
                  <p className="text-xs text-charcoal-200">Mantén presionado para volar</p>
                </>
              ) : (
                <>
                  <p className="font-display text-2xl tracking-wide">{score} parrillas</p>
                  <p className="text-xs text-charcoal-200">Toca para reintentar</p>
                </>
              )}
            </GameOverlay>
          )}
        </div>
      </GameShell>

      <Leaderboard game={GAME_SLUG} refreshKey={leaderboardKey} />
    </GameLayout>
  );
}

/** Dibuja un frame completo: fondo, parrillas, chispas y Mordi */
function draw(ctx: CanvasRenderingContext2D, g: GameRefState, score: number, dpr: number) {
  beginFrame(ctx, dpr, WORLD_WIDTH, WORLD_HEIGHT);

  // Fondo con gradiente vertical
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  sky.addColorStop(0, "#130C08");
  sky.addColorStop(0.5, "#2C1C14");
  sky.addColorStop(1, "#48200F");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Brasas difusas ambientales, con parallax lento derivado del tiempo
  for (let i = 0; i < 6; i++) {
    const drift = ((g.elapsedMs / 40) * (0.3 + i * 0.05)) % (WORLD_WIDTH + 160);
    const bx = WORLD_WIDTH + 80 - drift;
    const by = 90 + i * 92;
    const emberGlow = ctx.createRadialGradient(bx, by, 0, bx, by, 46);
    emberGlow.addColorStop(0, "rgba(232,92,43,0.2)");
    emberGlow.addColorStop(1, "rgba(232,92,43,0)");
    ctx.fillStyle = emberGlow;
    ctx.beginPath();
    ctx.arc(bx, by, 46, 0, Math.PI * 2);
    ctx.fill();
  }

  // Parrillas (tubos) con hueco
  for (const pipe of g.pipes) {
    drawPipe(ctx, pipe.x, pipe.gapY, pipe.gap, g.elapsedMs);
  }

  // Chispas del impulso
  for (const s of g.sparks) {
    ctx.fillStyle = `rgba(255,190,100,${Math.max(0, s.life * 2)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
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
  vignette.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Puntaje, con destello al sumar
  const flash = g.scoreFlash;
  ctx.font = `700 ${34 + flash * 8}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText(String(score), WORLD_WIDTH / 2 + 2, 58);
  ctx.fillStyle = flash > 0 ? `rgb(255,${230 - Math.round(flash * 60)},150)` : "#FBF6EE";
  ctx.fillText(String(score), WORLD_WIDTH / 2, 56);
}

/** Par de parrillas con hueco central: rejilla encendida, tapa metálica y resplandor de calor */
function drawPipe(ctx: CanvasRenderingContext2D, x: number, gapY: number, gap: number, elapsedMs: number) {
  const topHeight = gapY - gap / 2;
  const bottomY = gapY + gap / 2;
  const flicker = 0.75 + Math.sin(elapsedMs / 140 + x / 40) * 0.25;

  const bodyGrad = ctx.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  bodyGrad.addColorStop(0, "#1D1410");
  bodyGrad.addColorStop(0.35, "#4A382F");
  bodyGrad.addColorStop(0.6, "#5C4638");
  bodyGrad.addColorStop(1, "#1D1410");

  // Tramos
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(x, 0, PIPE_WIDTH, topHeight);
  ctx.fillRect(x, bottomY, PIPE_WIDTH, WORLD_HEIGHT - bottomY);

  // Rejilla encendida (barras horizontales que brillan)
  ctx.fillStyle = `rgba(232,92,43,${0.85 * flicker})`;
  for (let bar = 0; bar < Math.floor((topHeight - 18) / 22); bar++) {
    ctx.fillRect(x + 7, 12 + bar * 22, PIPE_WIDTH - 14, 3);
  }
  for (let bar = 0; bar < Math.floor((WORLD_HEIGHT - bottomY - 24) / 22); bar++) {
    ctx.fillRect(x + 7, bottomY + 30 + bar * 22, PIPE_WIDTH - 14, 3);
  }

  // Resplandor de calor asomando por el hueco
  const heatTop = ctx.createLinearGradient(0, topHeight - 26, 0, topHeight + 2);
  heatTop.addColorStop(0, "rgba(240,169,58,0)");
  heatTop.addColorStop(1, `rgba(240,169,58,${0.5 * flicker})`);
  ctx.fillStyle = heatTop;
  ctx.fillRect(x - 4, topHeight - 26, PIPE_WIDTH + 8, 28);

  const heatBottom = ctx.createLinearGradient(0, bottomY + 26, 0, bottomY - 2);
  heatBottom.addColorStop(0, "rgba(240,169,58,0)");
  heatBottom.addColorStop(1, `rgba(240,169,58,${0.5 * flicker})`);
  ctx.fillStyle = heatBottom;
  ctx.fillRect(x - 4, bottomY - 2, PIPE_WIDTH + 8, 28);

  // Tapas metálicas en el borde del hueco (grosor/profundidad del tubo)
  const capGrad = ctx.createLinearGradient(x - 5, 0, x + PIPE_WIDTH + 5, 0);
  capGrad.addColorStop(0, "#3A2C24");
  capGrad.addColorStop(0.45, "#7C6151");
  capGrad.addColorStop(1, "#3A2C24");
  ctx.fillStyle = capGrad;
  ctx.beginPath();
  ctx.roundRect(x - 5, topHeight - 16, PIPE_WIDTH + 10, 16, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 5, bottomY, PIPE_WIDTH + 10, 16, 3);
  ctx.fill();

  // Filo brillante en las tapas
  ctx.fillStyle = "rgba(255,235,200,0.35)";
  ctx.fillRect(x - 4, topHeight - 15, PIPE_WIDTH + 8, 1.5);
  ctx.fillRect(x - 4, bottomY + 1, PIPE_WIDTH + 8, 1.5);
}

/** Dibuja a Mordi volando: mismo diseño de cara que Mordi Runner, con giro según velocidad vertical */
function drawMordiFlyer(ctx: CanvasRenderingContext2D, g: GameRefState) {
  ctx.save();
  ctx.translate(MORDI_X, g.mordiY);
  const tilt = Math.max(-0.4, Math.min(0.5, g.velocityY / 700));
  ctx.rotate(tilt);

  const r = MORDI_SIZE / 2;

  // Pan inferior + relleno asomando
  ctx.fillStyle = "#B87519";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.6, r * 0.92, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#F5CE53";
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, r * 0.38);
  ctx.lineTo(r * 0.92, r * 0.38);
  ctx.lineTo(r * 0.6, r * 0.64);
  ctx.lineTo(r * 0.2, r * 0.44);
  ctx.lineTo(-r * 0.2, r * 0.64);
  ctx.lineTo(-r * 0.6, r * 0.44);
  ctx.closePath();
  ctx.fill();

  // Cuerpo (forma de pan, igual estilo que Mordi Runner para consistencia visual)
  const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.45, r * 0.15, 0, 0, r * 1.35);
  bodyGrad.addColorStop(0, "#FFD98A");
  bodyGrad.addColorStop(0.55, "#F0A93A");
  bodyGrad.addColorStop(1, "#C87E18");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.4);
  ctx.quadraticCurveTo(-r, -r, 0, -r);
  ctx.quadraticCurveTo(r, -r, r, r * 0.4);
  ctx.quadraticCurveTo(r, r * 0.7, 0, r * 0.7);
  ctx.quadraticCurveTo(-r, r * 0.7, -r, r * 0.4);
  ctx.closePath();
  ctx.fill();

  // Luz de borde
  ctx.strokeStyle = "rgba(255,240,196,0.5)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, -r * 0.3);
  ctx.quadraticCurveTo(-r * 0.5, -r * 0.92, r * 0.15, -r * 0.9);
  ctx.stroke();

  // Semillas de sésamo
  ctx.fillStyle = "rgba(255,246,232,0.9)";
  const seeds: [number, number][] = [
    [-r * 0.38, -r * 0.55],
    [0, -r * 0.72],
    [r * 0.38, -r * 0.55],
  ];
  seeds.forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.ellipse(sx, sy, 1.7, 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Mejillas
  ctx.fillStyle = "rgba(232,92,43,0.32)";
  ctx.beginPath();
  ctx.arc(-r * 0.55, r * 0.05, r * 0.16, 0, Math.PI * 2);
  ctx.arc(r * 0.55, r * 0.05, r * 0.16, 0, Math.PI * 2);
  ctx.fill();

  // Ojos grandes y alerta (siempre en modo "vuelo")
  ctx.fillStyle = "#1B1712";
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.08, 4.4, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.08, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FBF6EE";
  ctx.beginPath();
  ctx.arc(-r * 0.28 + 1.5, -r * 0.08 - 1.5, 1.4, 0, Math.PI * 2);
  ctx.arc(r * 0.28 + 1.5, -r * 0.08 - 1.5, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Boca pequeña y redonda (sorpresa constante del vuelo)
  ctx.strokeStyle = "#1B1712";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.13, r * 0.1, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
