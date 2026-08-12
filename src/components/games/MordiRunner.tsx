"use client";

import * as React from "react";
import { Gauge, Trophy, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/games/Leaderboard";
import { type MordiExpression } from "@/components/games/MordiSprite";
import { GameLayout, GameOverlay, GameResult, GameShell, GameStat } from "@/components/games/GameShell";
import { beginFrame, useHiDpiCanvas } from "@/components/games/canvas-utils";
import { useScoreSubmit } from "@/components/games/useScoreSubmit";
import { chanceFor, levelFor, ramp } from "@/components/games/difficulty";

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

const OBSTACLE_SIZE = 34;
const OBSTACLE_TALL = 46; // variante alta: sigue siendo saltable (el salto alcanza ~130px)

const BASE_SPEED = 320; // px/s
const MAX_SPEED = 720;
const SPEED_RAMP_PER_MS = 0.016; // cuánto sube la velocidad por ms transcurrido

// ── Dificultad progresiva ──
// Tres palancas que suben juntas con el tiempo transcurrido: la carrera
// acelera, los huecos entre parrillas se acortan y aparecen variantes
// (parrilla alta, parrilla doble).
//
// El piso del hueco NO es libre: el salto dura 2·|v|/g = 2·760/2200 ≈
// 690 ms en el aire. Un hueco menor que eso haría aterrizar a Mordi
// justo encima de la siguiente parrilla, o sea sería imposible, no
// difícil. Por eso el mínimo se queda en 780 ms.
const RAMP_OVER_MS = 60_000; // un minuto para llegar al tope de dificultad
const GAP_MIN_FROM = 950;
const GAP_MIN_TO = 820;
const GAP_MAX_FROM = 1600;
const GAP_MAX_TO = 1020;
const TALL_CHANCE_MAX = 0.45;
const CLUSTER_STARTS_AT_MS = 18_000;
const CLUSTER_MAX_CHANCE = 0.35;
const CLUSTER_OFFSET = 62; // px detrás de la primera: se limpian ambas de un salto

const MAX_EMBERS = 26; // tope duro de partículas: el fondo nunca debe costar más que el juego

type Obstacle = { x: number; passed: boolean; h: number };
type Ember = { x: number; y: number; vx: number; vy: number; r: number; life: number };

type RunState = "idle" | "playing" | "gameover";

/** Estado mutable del juego que vive fuera del ciclo de render de React */
type GameRefState = {
  mordiY: number;
  velocityY: number;
  onGround: boolean;
  obstacles: Obstacle[];
  embers: Ember[];
  nextObstacleInMs: number;
  elapsedMs: number;
  lastFrame: number;
  rafId: number;
  groundOffset: number;
  bgOffset: number;
  midOffset: number;
  speed: number;
};

function initialState(): GameRefState {
  return {
    mordiY: GROUND_Y - MORDI_SIZE,
    velocityY: 0,
    onGround: true,
    obstacles: [],
    embers: [],
    nextObstacleInMs: 1000,
    elapsedMs: 0,
    lastFrame: 0,
    rafId: 0,
    groundOffset: 0,
    bgOffset: 0,
    midOffset: 0,
    speed: BASE_SPEED,
  };
}

/**
 * Minijuego "Mordi Runner": Mordi corre automáticamente sobre el suelo y
 * el jugador salta obstáculos con un solo control (tap/click/espacio).
 * Usa Canvas 2D con requestAnimationFrame — el único de los juegos que
 * necesita un loop de render real — pero se mantiene liviano: colisión
 * por bounding-box (sin motor de física), parallax de 3 capas dibujado
 * con formas simples (sin sprite-sheets ni assets adicionales), y física
 * de salto minimalista (gravedad + velocidad).
 *
 * v2: buffer escalado al devicePixelRatio (antes se veía borroso en
 * móviles), tres capas de parallax con brasas flotando, y `setScore`
 * solo cuando el número realmente cambia — antes se llamaba en cada
 * frame, forzando un re-render de React 60 veces por segundo encima del
 * loop de canvas.
 */
export function MordiRunner() {
  const { submit, leaderboardKey, savedAs } = useScoreSubmit(GAME_SLUG);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dprRef = useHiDpiCanvas(canvasRef, WORLD_WIDTH, WORLD_HEIGHT);

  const [runState, setRunState] = React.useState<RunState>("idle");
  const [score, setScore] = React.useState(0);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);

  // Estado del juego que vive fuera de React (el loop de render no debe
  // esperar a los ciclos de commit de React — se lee/escribe directo en
  // refs y solo se sincroniza a React state para la UI de puntaje/fin).
  const gameRef = React.useRef<GameRefState>(initialState());

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
      // Polvo al despegar
      for (let i = 0; i < 6; i++) {
        g.embers.push({
          x: MORDI_X + MORDI_SIZE / 2,
          y: GROUND_Y - 4,
          vx: -40 - Math.random() * 90,
          vy: -20 - Math.random() * 50,
          r: 1.5 + Math.random() * 2,
          life: 0.5 + Math.random() * 0.3,
        });
      }
    }
  }, [runState]);

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
    let renderedScore = -1; // último valor sincronizado a React

    function frame(t: number) {
      if (cancelled) return;
      if (!g.lastFrame) g.lastFrame = t;
      const dt = Math.min((t - g.lastFrame) / 1000, 1 / 30); // clamp: evita saltos si la pestaña pierde foco
      g.lastFrame = t;
      g.elapsedMs += dt * 1000;

      const speed = Math.min(BASE_SPEED + g.elapsedMs * SPEED_RAMP_PER_MS, MAX_SPEED);
      g.speed = speed;

      // Física del salto
      g.velocityY += GRAVITY * dt;
      g.mordiY += g.velocityY * dt;
      const floorY = GROUND_Y - MORDI_SIZE;
      if (g.mordiY >= floorY) {
        g.mordiY = floorY;
        g.velocityY = 0;
        g.onGround = true;
      }

      // Parallax (3 capas a distintas velocidades)
      g.groundOffset = (g.groundOffset + speed * dt) % 40;
      g.midOffset = (g.midOffset + speed * dt * 0.55) % 220;
      g.bgOffset = (g.bgOffset + speed * dt * 0.22) % 160;

      // Brasas ambientales flotando hacia atrás
      if (g.embers.length < MAX_EMBERS && Math.random() < 0.35) {
        g.embers.push({
          x: WORLD_WIDTH + 10,
          y: 60 + Math.random() * (GROUND_Y - 70),
          vx: -speed * (0.25 + Math.random() * 0.25),
          vy: -8 - Math.random() * 18,
          r: 1 + Math.random() * 2.2,
          life: 1.4 + Math.random(),
        });
      }
      for (const e of g.embers) {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.life -= dt;
      }
      g.embers = g.embers.filter((e) => e.life > 0 && e.x > -20);

      // Spawn de obstáculos, con dificultad escalada por tiempo transcurrido
      g.nextObstacleInMs -= dt * 1000;
      if (g.nextObstacleInMs <= 0) {
        const tallChance = ramp(g.elapsedMs, 0.12, TALL_CHANCE_MAX, RAMP_OVER_MS);
        g.obstacles.push({
          x: WORLD_WIDTH + 20,
          passed: false,
          h: Math.random() < tallChance ? OBSTACLE_TALL : OBSTACLE_SIZE,
        });

        // Parrilla doble: dos pegadas que se limpian con un solo salto,
        // pero que castigan un salto tardío.
        const clusterChance = chanceFor(g.elapsedMs, CLUSTER_STARTS_AT_MS, CLUSTER_MAX_CHANCE, RAMP_OVER_MS);
        const clustered = Math.random() < clusterChance;
        if (clustered) {
          g.obstacles.push({ x: WORLD_WIDTH + 20 + CLUSTER_OFFSET, passed: false, h: OBSTACLE_SIZE });
        }

        // El hueco se mide desde la ÚLTIMA parrilla puesta. Si fue doble,
        // la segunda llega CLUSTER_OFFSET px más tarde, así que hay que
        // sumar ese tiempo — si no, el hueco real se acorta justo cuando
        // ya está al límite de lo saltable y el juego se vuelve imposible
        // en vez de difícil.
        const minGap = ramp(g.elapsedMs, GAP_MIN_FROM, GAP_MIN_TO, RAMP_OVER_MS);
        const maxGap = ramp(g.elapsedMs, GAP_MAX_FROM, GAP_MAX_TO, RAMP_OVER_MS);
        const clusterDelayMs = clustered ? (CLUSTER_OFFSET / speed) * 1000 : 0;
        g.nextObstacleInMs = minGap + Math.random() * (maxGap - minGap) + clusterDelayMs;
      }

      // Mover obstáculos + detectar puntaje + colisión
      const mordiBox = {
        x: MORDI_X + 9,
        y: g.mordiY + 9,
        w: MORDI_SIZE - 18,
        h: MORDI_SIZE - 18,
      };

      let collided = false;
      for (const ob of g.obstacles) {
        ob.x -= speed * dt;
        if (!ob.passed && ob.x + OBSTACLE_SIZE < MORDI_X) {
          ob.passed = true;
          currentScore += 1;
        }
        const obBox = { x: ob.x + 5, y: GROUND_Y - ob.h + 4, w: OBSTACLE_SIZE - 10, h: ob.h - 6 };
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

      // Solo se sincroniza a React cuando el número cambia (antes: 60 veces por segundo)
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

    submit(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState]);

  // Dibuja el estado inicial/estático cuando no está jugando
  React.useEffect(() => {
    if (runState === "playing") return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    draw(ctx, gameRef.current, score, dprRef.current);
  }, [runState, score, dprRef]);

  const speedPct = Math.round(((gameRef.current.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)) * 100);
  const level = levelFor(gameRef.current.elapsedMs, RAMP_OVER_MS / 6);
  const mordiMood: MordiExpression =
    runState === "gameover" ? (isNewRecord ? "love" : "dizzy") : runState === "playing" ? "determined" : "happy";

  return (
    <GameLayout>
      <GameShell
        title="MORDI RUNNER"
        subtitle="Mordi corre solo: salta las parrillas con un tap, click o la barra espaciadora. ¡Va acelerando!"
        mordi={mordiMood}
        bareBoard
        hud={
          <>
            <GameStat icon={<Target className="h-4 w-4" />} label="Obstáculos" value={score} />
            {bestScore > 0 && (
              <GameStat icon={<Trophy className="h-4 w-4" />} label="Récord" value={bestScore} tone="gold" />
            )}
            {runState === "playing" && (
              <>
                <GameStat
                  icon={<TrendingUp className="h-4 w-4" />}
                  label="Nivel"
                  value={level}
                  tone={level >= 4 ? "ember" : "neutral"}
                />
                <GameStat
                  icon={<Gauge className="h-4 w-4" />}
                  label="Velocidad"
                  value={`${Math.max(0, Math.min(100, speedPct))}%`}
                  tone="ember"
                />
              </>
            )}
          </>
        }
        footer={
          runState === "gameover" ? (
            <GameResult
              isNewRecord={isNewRecord}
              headline={`${score} ${score === 1 ? "obstáculo" : "obstáculos"}`}
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
              Toca la pantalla o presiona espacio para saltar
            </p>
          )
        }
      >
        <div
          onPointerDown={handlePointerDown}
          className="relative w-full cursor-pointer touch-none select-none overflow-hidden rounded-2xl"
          style={{ aspectRatio: `${WORLD_WIDTH} / ${WORLD_HEIGHT}` }}
        >
          <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} className="block h-full w-full" />

          {runState !== "playing" && (
            <GameOverlay mordi={runState === "gameover" ? (isNewRecord ? "love" : "dizzy") : "happy"}>
              {runState === "idle" ? (
                <>
                  <p className="font-display text-xl tracking-wide">Toca para empezar</p>
                  <p className="text-xs text-charcoal-200">Espacio, click o tap para saltar</p>
                </>
              ) : (
                <>
                  <p className="font-display text-2xl tracking-wide">{score} obstáculos</p>
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

/** Dibuja un frame completo: cielo, parallax de 3 capas, suelo, Mordi y obstáculos */
function draw(ctx: CanvasRenderingContext2D, g: GameRefState, score: number, dpr: number) {
  beginFrame(ctx, dpr, WORLD_WIDTH, WORLD_HEIGHT);

  // ── Cielo nocturno de brasas ──
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#150E0A");
  sky.addColorStop(0.55, "#2A1811");
  sky.addColorStop(1, "#4A2415");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD_WIDTH, GROUND_Y);

  // Resplandor ambiental (brasa lejana, tipo sol poniente)
  const glow = ctx.createRadialGradient(640, GROUND_Y - 30, 10, 640, GROUND_Y - 30, 210);
  glow.addColorStop(0, "rgba(240,169,58,0.42)");
  glow.addColorStop(0.5, "rgba(232,92,43,0.18)");
  glow.addColorStop(1, "rgba(232,92,43,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(400, 20, 480, GROUND_Y);

  // ── Capa lejana: colinas suaves ──
  ctx.fillStyle = "rgba(90,44,25,0.55)";
  for (let i = -1; i < 7; i++) {
    const x = i * 160 - g.bgOffset;
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 4, 105, 46, 0, Math.PI, 0);
    ctx.fill();
  }

  // ── Capa media: siluetas de puestos/parrillas con chimenea ──
  for (let i = -1; i < 5; i++) {
    const x = i * 220 - g.midOffset;
    drawStallSilhouette(ctx, x, GROUND_Y);
  }

  // ── Brasas flotando ──
  for (const e of g.embers) {
    const alpha = Math.max(0, Math.min(1, e.life)) * 0.75;
    ctx.fillStyle = `rgba(250,180,90,${alpha})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Suelo: tablón de madera con vetas y junta luminosa ──
  const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_HEIGHT);
  groundGrad.addColorStop(0, "#3A281E");
  groundGrad.addColorStop(1, "#150E09");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y);

  // Junta iluminada por las brasas
  const rim = ctx.createLinearGradient(0, GROUND_Y - 3, 0, GROUND_Y + 6);
  rim.addColorStop(0, "rgba(240,169,58,0)");
  rim.addColorStop(0.5, "rgba(240,169,58,0.65)");
  rim.addColorStop(1, "rgba(240,169,58,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, GROUND_Y - 3, WORLD_WIDTH, 9);

  // Tablones que se desplazan
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 2;
  for (let i = -1; i < WORLD_WIDTH / 40 + 2; i++) {
    const x = i * 40 - g.groundOffset;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y + 2);
    ctx.lineTo(x - 8, WORLD_HEIGHT);
    ctx.stroke();
  }

  // Obstáculos
  for (const ob of g.obstacles) {
    drawGrillObstacle(ctx, ob.x, GROUND_Y, ob.h, g.elapsedMs);
  }

  // Mordi
  drawMordiRunner(ctx, g);

  // Puntaje en canvas (respaldo visual, además del HUD de arriba)
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText(String(score), 19, 37);
  ctx.fillStyle = "#FBF6EE";
  ctx.fillText(String(score), 18, 36);
}

/** Silueta de un puesto de comida al fondo, con toldo y chimenea humeante */
function drawStallSilhouette(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  ctx.fillStyle = "rgba(38,20,13,0.9)";
  // Cuerpo
  ctx.fillRect(x, groundY - 62, 96, 62);
  // Toldo
  ctx.beginPath();
  ctx.moveTo(x - 10, groundY - 62);
  ctx.lineTo(x + 106, groundY - 62);
  ctx.lineTo(x + 96, groundY - 76);
  ctx.lineTo(x, groundY - 76);
  ctx.closePath();
  ctx.fill();
  // Chimenea
  ctx.fillRect(x + 68, groundY - 96, 14, 22);

  // Ventana iluminada
  ctx.fillStyle = "rgba(240,169,58,0.35)";
  ctx.fillRect(x + 16, groundY - 50, 34, 22);
  ctx.fillStyle = "rgba(240,169,58,0.18)";
  ctx.fillRect(x + 58, groundY - 50, 24, 22);
}

/** Mini-parrilla con patas, rejilla metálica y brasas con resplandor pulsante */
function drawGrillObstacle(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number, elapsedMs: number) {
  const w = OBSTACLE_SIZE;
  const y = groundY - h;
  const flicker = 0.75 + Math.sin(elapsedMs / 120 + x) * 0.25;

  // Resplandor bajo la parrilla, sobre el suelo
  const floorGlow = ctx.createRadialGradient(x + w / 2, groundY, 2, x + w / 2, groundY, 34);
  floorGlow.addColorStop(0, `rgba(232,92,43,${0.4 * flicker})`);
  floorGlow.addColorStop(1, "rgba(232,92,43,0)");
  ctx.fillStyle = floorGlow;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, groundY, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Patas
  ctx.strokeStyle = "#241A14";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 5, y + h * 0.62);
  ctx.lineTo(x + 1, groundY - 2);
  ctx.moveTo(x + w - 5, y + h * 0.62);
  ctx.lineTo(x + w - 1, groundY - 2);
  ctx.stroke();

  // Cuerpo de la parrilla
  const body = ctx.createLinearGradient(x, y, x, y + h * 0.62);
  body.addColorStop(0, "#6A5245");
  body.addColorStop(0.5, "#3D2C22");
  body.addColorStop(1, "#241A14");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h * 0.62, 5);
  ctx.fill();

  // Brasas con resplandor
  for (let i = 0; i < 3; i++) {
    const bx = x + 6 + i * ((w - 12) / 2);
    const by = y + h * 0.3;
    const emberGlow = ctx.createRadialGradient(bx, by, 0, bx, by, 7 * flicker);
    emberGlow.addColorStop(0, "#FFF0B8");
    emberGlow.addColorStop(0.45, "#F0A93A");
    emberGlow.addColorStop(1, "rgba(232,92,43,0)");
    ctx.fillStyle = emberGlow;
    ctx.beginPath();
    ctx.arc(bx, by, 7 * flicker, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rejilla (barras verticales sobre las brasas)
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.6;
  for (let i = 1; i < 4; i++) {
    const lx = x + (w / 4) * i;
    ctx.beginPath();
    ctx.moveTo(lx, y + 3);
    ctx.lineTo(lx, y + h * 0.6);
    ctx.stroke();
  }

  // Llamita en las parrillas altas, para leerlas de un vistazo
  if (h > OBSTACLE_SIZE) {
    ctx.fillStyle = `rgba(240,169,58,${0.65 * flicker})`;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 12 * flicker);
    ctx.quadraticCurveTo(x + w * 0.82, y + 2, x + w / 2, y + 6);
    ctx.quadraticCurveTo(x + w * 0.18, y + 2, x + w / 2, y - 12 * flicker);
    ctx.fill();
  }
}

/** Dibuja a Mordi corriendo: cuerpo tipo pan de hamburguesa, cara expresiva y piernas animadas */
function drawMordiRunner(ctx: CanvasRenderingContext2D, g: GameRefState) {
  const bounce = g.onGround ? Math.sin(g.elapsedMs / 90) * 3 : 0;
  const cx = MORDI_X + MORDI_SIZE / 2;
  const cy = g.mordiY + MORDI_SIZE / 2 + bounce;
  const r = MORDI_SIZE / 2;

  // Sombra de contacto en el suelo — se dibuja en el suelo, no pegada al cuerpo
  const heightAboveGround = Math.max(0, GROUND_Y - (cy + r));
  const shadowScale = Math.max(0.4, 1 - heightAboveGround / 110);
  ctx.fillStyle = `rgba(0,0,0,${0.32 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(cx, GROUND_Y - 2, r * 0.85 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  const tilt = g.onGround ? 0 : Math.max(-0.25, Math.min(0.25, g.velocityY / 3000));
  ctx.rotate(tilt);

  // Piernas corriendo (alternan si está en el suelo; quietas y flexionadas en el aire)
  const legPhase = g.onGround ? Math.sin(g.elapsedMs / 55) : 0;
  ctx.strokeStyle = "#8C5A3F";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, r * 0.7);
  ctx.lineTo(-r * 0.4 + legPhase * 8, r * 0.7 + 10 - Math.abs(legPhase) * 4);
  ctx.moveTo(r * 0.4, r * 0.7);
  ctx.lineTo(r * 0.4 - legPhase * 8, r * 0.7 + 10 - Math.abs(legPhase) * 4);
  ctx.stroke();

  // Pan inferior (asoma bajo la cara)
  ctx.fillStyle = "#B87519";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.62, r * 0.92, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Relleno: queso asomando
  ctx.fillStyle = "#F5CE53";
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, r * 0.4);
  ctx.lineTo(r * 0.95, r * 0.4);
  ctx.lineTo(r * 0.7, r * 0.68);
  ctx.lineTo(r * 0.25, r * 0.45);
  ctx.lineTo(-r * 0.25, r * 0.68);
  ctx.lineTo(-r * 0.7, r * 0.45);
  ctx.closePath();
  ctx.fill();

  // Cuerpo (forma de pan: base recta, parte superior curva)
  const bodyGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.45, r * 0.15, 0, 0, r * 1.35);
  bodyGrad.addColorStop(0, "#FFD98A");
  bodyGrad.addColorStop(0.55, "#F0A93A");
  bodyGrad.addColorStop(1, "#C87E18");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.42);
  ctx.quadraticCurveTo(-r, -r, 0, -r);
  ctx.quadraticCurveTo(r, -r, r, r * 0.42);
  ctx.quadraticCurveTo(r, r * 0.72, 0, r * 0.72);
  ctx.quadraticCurveTo(-r, r * 0.72, -r, r * 0.42);
  ctx.closePath();
  ctx.fill();

  // Luz de borde superior
  ctx.strokeStyle = "rgba(255,240,196,0.5)";
  ctx.lineWidth = 2.5;
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
    ctx.ellipse(sx, sy, 1.8, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Mejillas
  ctx.fillStyle = "rgba(232,92,43,0.32)";
  ctx.beginPath();
  ctx.arc(-r * 0.55, r * 0.05, r * 0.17, 0, Math.PI * 2);
  ctx.arc(r * 0.55, r * 0.05, r * 0.17, 0, Math.PI * 2);
  ctx.fill();

  // Ojos (decididos al saltar, redondos al correr)
  ctx.fillStyle = "#1B1712";
  if (g.onGround) {
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.05, 3.8, 0, Math.PI * 2);
    ctx.arc(r * 0.3, -r * 0.05, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FBF6EE";
    ctx.beginPath();
    ctx.arc(-r * 0.3 + 1.3, -r * 0.05 - 1.3, 1.2, 0, Math.PI * 2);
    ctx.arc(r * 0.3 + 1.3, -r * 0.05 - 1.3, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = "#1B1712";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, -r * 0.05);
    ctx.lineTo(-r * 0.18, -r * 0.05);
    ctx.moveTo(r * 0.18, -r * 0.05);
    ctx.lineTo(r * 0.42, -r * 0.05);
    ctx.stroke();
  }

  // Boca
  ctx.strokeStyle = "#1B1712";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (g.onGround) {
    ctx.moveTo(-r * 0.28, r * 0.22);
    ctx.quadraticCurveTo(0, r * 0.4, r * 0.28, r * 0.22);
  } else {
    ctx.ellipse(0, r * 0.28, r * 0.15, r * 0.11, 0, 0, Math.PI * 2);
  }
  ctx.stroke();

  ctx.restore();
}
