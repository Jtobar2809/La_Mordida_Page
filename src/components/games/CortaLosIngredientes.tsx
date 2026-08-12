"use client";

import * as React from "react";
import { Heart, Scissors, Trophy, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/games/Leaderboard";
import { type MordiExpression } from "@/components/games/MordiSprite";
import { GameLayout, GameOverlay, GameResult, GameShell, GameStat } from "@/components/games/GameShell";
import { beginFrame, useHiDpiCanvas } from "@/components/games/canvas-utils";
import { useScoreSubmit } from "@/components/games/useScoreSubmit";
import { chanceFor, levelFor, ramp } from "@/components/games/difficulty";
import { cn } from "@/lib/utils";

const GAME_SLUG = "corta-los-ingredientes";
const BEST_SCORE_KEY = "lm_game_best_corta-los-ingredientes";

const WORLD_WIDTH = 480;
const WORLD_HEIGHT = 560;

const GRAVITY = 900; // px/s²
const ITEM_RADIUS = 26;
const START_LIVES = 3;

// ── Dificultad progresiva ──
// Con cada corte la cocina se acelera: los ingredientes salen más
// seguido, empiezan a salir de a dos y tres, y la proporción de bombas
// sube. Las vidas siguen siendo 3, así que la presión real es tener que
// elegir qué cortar cuando hay cinco cosas en el aire.
const RAMP_OVER_CUTS = 40;
const SPAWN_MIN_FROM = 640;
const SPAWN_MIN_TO = 300;
const SPAWN_MAX_FROM = 1000;
const SPAWN_MAX_TO = 520;
const BOMB_CHANCE_FROM = 0.1;
const BOMB_CHANCE_TO = 0.26;
const DOUBLE_STARTS_AT = 8;
const DOUBLE_MAX_CHANCE = 0.6;
const TRIPLE_STARTS_AT = 20;
const TRIPLE_MAX_CHANCE = 0.35;

// Cuánto tiempo (en puntos del trazo) se conserva el rastro del cursor
// para detectar cortes — un buffer corto y no todo el historial de sesión.
const TRAIL_MAX_POINTS = 10;
const TRAIL_MAX_AGE_MS = 130;

const COMBO_WINDOW_MS = 420; // dos cortes dentro de esta ventana cuentan como combo
const MAX_PARTICLES = 90;

const INGREDIENTS = [
  { id: "tomato", juice: "#D6483C" },
  { id: "cheese", juice: "#F0C94A" },
  { id: "lettuce", juice: "#7FA357" },
  { id: "bacon", juice: "#C1544B" },
  { id: "bun", juice: "#E4B071" },
] as const;

// INGREDIENTS nunca está vacío (literal fijo de 5 elementos definido
// arriba), así que el índice 0 siempre existe. Única aserción no-null
// del archivo, usada como fallback para cualquier índice fuera de rango.
const FALLBACK_INGREDIENT = INGREDIENTS[0]!;

type IngredientId = (typeof INGREDIENTS)[number]["id"];
type ItemKind = IngredientId | "bomb";

type FlyingItem = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  kind: ItemKind;
};
/** Mitad de un ingrediente ya cortado: sale despedida con su propio giro */
type Half = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  kind: IngredientId;
  side: -1 | 1;
  life: number;
};
type Particle = { x: number; y: number; vx: number; vy: number; r: number; life: number; color: string };
type TrailPoint = { x: number; y: number; t: number };
type RunState = "idle" | "playing" | "gameover";

type GameRefState = {
  items: FlyingItem[];
  halves: Half[];
  particles: Particle[];
  trail: TrailPoint[];
  nextSpawnInMs: number;
  elapsedMs: number;
  lastFrame: number;
  rafId: number;
  idCounter: number;
  comboCount: number;
  comboUntilMs: number;
  comboShowUntilMs: number;
  comboShown: number;
  flash: number; // 0..1, destello blanco de la explosión
};

function initialState(): GameRefState {
  return {
    items: [],
    halves: [],
    particles: [],
    trail: [],
    nextSpawnInMs: 400,
    elapsedMs: 0,
    lastFrame: 0,
    rafId: 0,
    idCounter: 0,
    comboCount: 0,
    comboUntilMs: 0,
    comboShowUntilMs: 0,
    comboShown: 0,
    flash: 0,
  };
}

function juiceColor(kind: IngredientId) {
  return (INGREDIENTS.find((i) => i.id === kind) ?? FALLBACK_INGREDIENT).juice;
}

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
 *
 * v2: el corte ahora parte el ingrediente en dos mitades que salen
 * despedidas con su propio giro y salpican jugo del color correcto —
 * antes el objeto simplemente bajaba su opacidad, que es la parte del
 * género donde se juega toda la satisfacción. Además: canvas escalado al
 * devicePixelRatio, estela con degradado en vez de línea plana, contador
 * de combo y sincronización de puntaje/vidas a React solo cuando cambian.
 */
export function CortaLosIngredientes() {
  const { submit, leaderboardKey, savedAs } = useScoreSubmit(GAME_SLUG);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dprRef = useHiDpiCanvas(canvasRef, WORLD_WIDTH, WORLD_HEIGHT);

  const [runState, setRunState] = React.useState<RunState>("idle");
  const [score, setScore] = React.useState(0);
  const [lives, setLives] = React.useState(START_LIVES);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);
  const [bombHit, setBombHit] = React.useState(false);

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
    setLives(START_LIVES);
    setIsNewRecord(false);
    setBombHit(false);
    setRunState("playing");
  }

  function endGame(finalScore: number) {
    setRunState("gameover");
    setScore(finalScore);
  }

  /** Lanza un objeto. `cuts` define qué tan probable es que sea bomba. */
  function spawnItem(g: GameRefState, cuts: number) {
    const isBomb = Math.random() < ramp(cuts, BOMB_CHANCE_FROM, BOMB_CHANCE_TO, RAMP_OVER_CUTS);
    const x = 60 + Math.random() * (WORLD_WIDTH - 120);
    const vx = (Math.random() - 0.5) * 160;
    const vy = -(750 + Math.random() * 250); // impulso hacia arriba

    const ing = isBomb ? null : INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)] ?? FALLBACK_INGREDIENT;
    g.items.push({
      id: g.idCounter++,
      x,
      y: WORLD_HEIGHT + ITEM_RADIUS,
      vx,
      vy,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 4,
      radius: ITEM_RADIUS,
      kind: isBomb ? "bomb" : (ing?.id ?? FALLBACK_INGREDIENT.id),
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
    let renderedScore = -1;
    let renderedLives = -1;

    function sliceItem(item: FlyingItem) {
      // Dos mitades que se separan perpendicularmente a la trayectoria
      for (const side of [-1, 1] as const) {
        g.halves.push({
          x: item.x,
          y: item.y,
          vx: item.vx + side * (70 + Math.random() * 60),
          vy: item.vy * 0.55 - Math.random() * 60,
          rotation: item.rotation,
          rotationSpeed: item.rotationSpeed + side * 3.5,
          radius: item.radius,
          kind: item.kind as IngredientId,
          side,
          life: 1.4,
        });
      }
      // Salpicadura de jugo del color del ingrediente
      const color = juiceColor(item.kind as IngredientId);
      const budget = Math.min(14, MAX_PARTICLES - g.particles.length);
      for (let i = 0; i < budget; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 190;
        g.particles.push({
          x: item.x,
          y: item.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          r: 1.5 + Math.random() * 3,
          life: 0.4 + Math.random() * 0.4,
          color,
        });
      }
    }

    function explodeBomb(item: FlyingItem) {
      g.flash = 1;
      const budget = Math.min(30, MAX_PARTICLES - g.particles.length);
      for (let i = 0; i < budget; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 120 + Math.random() * 320;
        g.particles.push({
          x: item.x,
          y: item.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 2 + Math.random() * 4,
          life: 0.5 + Math.random() * 0.4,
          color: Math.random() < 0.5 ? "#F0A93A" : "#E85C2B",
        });
      }
    }

    function frame(t: number) {
      if (cancelled) return;
      if (!g.lastFrame) g.lastFrame = t;
      const dt = Math.min((t - g.lastFrame) / 1000, 1 / 30);
      g.lastFrame = t;
      g.elapsedMs += dt * 1000;
      g.flash = Math.max(0, g.flash - dt * 3);

      // Limpia puntos viejos del rastro
      const now = performance.now();
      g.trail = g.trail.filter((p) => now - p.t < TRAIL_MAX_AGE_MS);

      // Spawns, con cadencia y tandas escaladas por cortes acumulados
      g.nextSpawnInMs -= dt * 1000;
      if (g.nextSpawnInMs <= 0) {
        let batch = 1;
        if (Math.random() < chanceFor(currentScore, DOUBLE_STARTS_AT, DOUBLE_MAX_CHANCE, RAMP_OVER_CUTS)) batch = 2;
        if (Math.random() < chanceFor(currentScore, TRIPLE_STARTS_AT, TRIPLE_MAX_CHANCE, RAMP_OVER_CUTS)) batch = 3;
        for (let i = 0; i < batch; i++) spawnItem(g, currentScore);

        const minMs = ramp(currentScore, SPAWN_MIN_FROM, SPAWN_MIN_TO, RAMP_OVER_CUTS);
        const maxMs = ramp(currentScore, SPAWN_MAX_FROM, SPAWN_MAX_TO, RAMP_OVER_CUTS);
        g.nextSpawnInMs = minMs + Math.random() * (maxMs - minMs);
      }

      let hitBomb = false;
      const survivors: FlyingItem[] = [];

      for (const item of g.items) {
        item.vy += GRAVITY * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        item.rotation += item.rotationSpeed * dt;

        // Detección de corte: ¿algún segmento reciente del trazo cruza este ítem?
        let sliced = false;
        for (let i = 1; i < g.trail.length; i++) {
          const a = g.trail[i - 1];
          const b = g.trail[i];
          if (!a || !b) continue;
          if (pointToSegmentDistance(item.x, item.y, a.x, a.y, b.x, b.y) < item.radius) {
            sliced = true;
            break;
          }
        }

        if (sliced) {
          if (item.kind === "bomb") {
            explodeBomb(item);
            hitBomb = true;
          } else {
            currentScore += 1;
            sliceItem(item);
            // Combo: cortes encadenados dentro de una ventana corta
            if (g.elapsedMs < g.comboUntilMs) {
              g.comboCount += 1;
            } else {
              g.comboCount = 1;
            }
            g.comboUntilMs = g.elapsedMs + COMBO_WINDOW_MS;
            if (g.comboCount >= 2) {
              g.comboShown = g.comboCount;
              g.comboShowUntilMs = g.elapsedMs + 800;
            }
          }
          continue; // el ítem deja de existir: ya son mitades/partículas
        }

        // Cayó fuera de la pantalla sin cortar
        if (item.y - item.radius > WORLD_HEIGHT && item.vy > 0) {
          if (item.kind !== "bomb") currentLives -= 1;
          continue;
        }

        survivors.push(item);
      }
      g.items = survivors;

      // Mitades cortadas
      for (const h of g.halves) {
        h.vy += GRAVITY * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.rotation += h.rotationSpeed * dt;
        h.life -= dt;
      }
      g.halves = g.halves.filter((h) => h.life > 0 && h.y - h.radius < WORLD_HEIGHT + 60);

      // Partículas de jugo
      for (const p of g.particles) {
        p.vy += GRAVITY * 0.55 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      g.particles = g.particles.filter((p) => p.life > 0);

      if (currentScore !== renderedScore) {
        renderedScore = currentScore;
        setScore(currentScore);
      }
      if (currentLives !== renderedLives) {
        renderedLives = currentLives;
        setLives(currentLives);
      }

      draw(ctx, g, dprRef.current);

      if (hitBomb) {
        setBombHit(true);
        endGame(currentScore);
        return;
      }
      if (currentLives <= 0) {
        endGame(currentScore);
        return;
      }

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
    draw(ctx, gameRef.current, dprRef.current);
  }, [runState, dprRef]);

  const mordiMood: MordiExpression =
    runState === "gameover" ? (isNewRecord ? "love" : bombHit ? "dizzy" : "sad") : runState === "playing" ? "cool" : "happy";

  return (
    <GameLayout wide>
      <GameShell
        title="CORTA LOS INGREDIENTES"
        subtitle="Desliza el dedo o el mouse para cortar los ingredientes en el aire. ¡Cuidado con las bombas!"
        mordi={mordiMood}
        bareBoard
        hud={
          <>
            <GameStat icon={<Scissors className="h-4 w-4" />} label="Cortes" value={score} />
            <GameStat
              icon={<TrendingUp className="h-4 w-4" />}
              label="Nivel"
              value={levelFor(score, 6)}
              tone={score >= DOUBLE_STARTS_AT ? "ember" : "neutral"}
            />
            {bestScore > 0 && (
              <GameStat icon={<Trophy className="h-4 w-4" />} label="Récord" value={bestScore} tone="gold" />
            )}
            <GameStat
              tone={lives <= 1 ? "danger" : "neutral"}
              value={
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: START_LIVES }).map((_, i) => (
                    <Heart
                      key={i}
                      className={cn("h-3.5 w-3.5", i < lives ? "fill-ember-400 text-ember-400" : "text-charcoal-500")}
                    />
                  ))}
                </span>
              }
            />
          </>
        }
        footer={
          runState === "gameover" ? (
            <GameResult
              isNewRecord={isNewRecord}
              headline={`${score} ${score === 1 ? "corte" : "cortes"}`}
              detail={bombHit ? "¡Cortaste una bomba!" : "Te quedaste sin vidas"}
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
              Encadena cortes seguidos para hacer combo
            </p>
          )
        }
      >
        <div
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          className="relative mx-auto w-full max-w-[340px] cursor-crosshair touch-none select-none overflow-hidden rounded-2xl"
          style={{ aspectRatio: `${WORLD_WIDTH} / ${WORLD_HEIGHT}` }}
        >
          <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} className="block h-full w-full" />

          {runState !== "playing" && (
            <GameOverlay mordi={runState === "gameover" ? (isNewRecord ? "love" : "dizzy") : "happy"}>
              {runState === "idle" ? (
                <>
                  <p className="font-display text-xl tracking-wide">Toca para empezar</p>
                  <p className="text-xs text-charcoal-200">Desliza para cortar</p>
                </>
              ) : (
                <>
                  {bombHit && <p className="text-sm font-semibold text-red-400">¡Cortaste una bomba!</p>}
                  <p className="font-display text-2xl tracking-wide">{score} cortes</p>
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

/** Dibuja un frame completo: fondo, ítems, mitades, jugo y estela */
function draw(ctx: CanvasRenderingContext2D, g: GameRefState, dpr: number) {
  beginFrame(ctx, dpr, WORLD_WIDTH, WORLD_HEIGHT);

  // Fondo: tabla de cortar sobre penumbra de cocina
  const bg = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  bg.addColorStop(0, "#150E0A");
  bg.addColorStop(0.6, "#2C1C14");
  bg.addColorStop(1, "#3E2415");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Foco cenital
  const spot = ctx.createRadialGradient(WORLD_WIDTH / 2, 40, 20, WORLD_WIDTH / 2, 40, WORLD_HEIGHT * 0.85);
  spot.addColorStop(0, "rgba(255,220,160,0.14)");
  spot.addColorStop(1, "rgba(255,220,160,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Vetas de la tabla al fondo
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 8;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 90 + 20, 0);
    ctx.lineTo(i * 90 - 10, WORLD_HEIGHT);
    ctx.stroke();
  }

  // Mitades cortadas (se dibujan detrás de los ítems enteros)
  for (const h of g.halves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, h.life));
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rotation);
    // Recorta a media pieza y dibuja el ingrediente completo dentro
    ctx.beginPath();
    ctx.rect(h.side < 0 ? -h.radius * 1.4 : 0, -h.radius * 1.4, h.radius * 1.4, h.radius * 2.8);
    ctx.clip();
    drawFlyingIngredient(ctx, h.kind, h.radius);
    // Cara del corte, más clara
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(h.side < 0 ? -2.5 : 0, -h.radius, 2.5, h.radius * 2);
    ctx.restore();
  }

  // Partículas de jugo
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ítems en vuelo, dibujados vectorialmente (sin emojis)
  for (const item of g.items) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    if (item.kind === "bomb") {
      drawBomb(ctx, item.radius);
    } else {
      drawFlyingIngredient(ctx, item.kind, item.radius);
    }
    ctx.restore();
  }

  // Estela del cursor: cinta que se afina, con halo — como el filo de un cuchillo
  if (g.trail.length > 1) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < g.trail.length; i++) {
        const a = g.trail[i - 1];
        const b = g.trail[i];
        if (!a || !b) continue;
        const progress = i / g.trail.length; // 0 = más viejo, 1 = más reciente
        if (pass === 0) {
          // halo cálido
          ctx.strokeStyle = `rgba(240,169,58,${0.1 + progress * 0.28})`;
          ctx.lineWidth = 6 + progress * 12;
        } else {
          ctx.strokeStyle = `rgba(255,255,255,${0.15 + progress * 0.8})`;
          ctx.lineWidth = 1.5 + progress * 4.5;
        }
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // Contador de combo
  if (g.elapsedMs < g.comboShowUntilMs && g.comboShown >= 2) {
    const remaining = (g.comboShowUntilMs - g.elapsedMs) / 800;
    ctx.globalAlpha = Math.min(1, remaining * 1.6);
    ctx.textAlign = "center";
    ctx.font = "800 34px system-ui, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillText(`COMBO x${g.comboShown}`, WORLD_WIDTH / 2 + 2, WORLD_HEIGHT / 2 + 2);
    ctx.fillStyle = "#F0A93A";
    ctx.fillText(`COMBO x${g.comboShown}`, WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    ctx.globalAlpha = 1;
  }

  // Destello de la explosión
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,235,200,${g.flash * 0.75})`;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

/** Bomba: esfera oscura metálica con mecha encendida */
function drawBomb(ctx: CanvasRenderingContext2D, radius: number) {
  // Aura de peligro para que nunca se confunda con un ingrediente
  const danger = ctx.createRadialGradient(0, 0, radius * 0.6, 0, 0, radius * 1.6);
  danger.addColorStop(0, "rgba(220,40,30,0.35)");
  danger.addColorStop(1, "rgba(220,40,30,0)");
  ctx.fillStyle = danger;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
  bodyGrad.addColorStop(0, "#5A5A5A");
  bodyGrad.addColorStop(1, "#0B0B0B");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Brillo especular
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(-radius * 0.3, -radius * 0.35, radius * 0.22, radius * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Mecha
  ctx.strokeStyle = "#8C5A3F";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(radius * 0.1, -radius * 0.85);
  ctx.quadraticCurveTo(radius * 0.4, -radius * 1.15, radius * 0.25, -radius * 1.35);
  ctx.stroke();

  // Chispa en la punta de la mecha
  const sparkGlow = ctx.createRadialGradient(radius * 0.25, -radius * 1.35, 0, radius * 0.25, -radius * 1.35, 7);
  sparkGlow.addColorStop(0, "#FFFFFF");
  sparkGlow.addColorStop(0.35, "#FBE27A");
  sparkGlow.addColorStop(1, "rgba(251,226,122,0)");
  ctx.fillStyle = sparkGlow;
  ctx.beginPath();
  ctx.arc(radius * 0.25, -radius * 1.35, 7, 0, Math.PI * 2);
  ctx.fill();
}

/** Dibuja cada ingrediente volando, con forma propia según su tipo */
function drawFlyingIngredient(ctx: CanvasRenderingContext2D, kind: IngredientId, radius: number) {
  const r = radius * 0.85;

  if (kind === "tomato") {
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#F2837A");
    grad.addColorStop(1, "#B8342A");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.38, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5E7440";
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.75, r * 0.35, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (kind === "cheese") {
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, "#FDEB9C");
    grad.addColorStop(1, "#E4B02C");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.4);
    ctx.lineTo(r, -r * 0.7);
    ctx.lineTo(r * 0.7, r * 0.8);
    ctx.lineTo(-r * 0.9, r * 0.6);
    ctx.closePath();
    ctx.fill();
    // Agujeros del queso
    ctx.fillStyle = "rgba(180,120,20,0.45)";
    ctx.beginPath();
    ctx.arc(-r * 0.25, r * 0.05, r * 0.16, 0, Math.PI * 2);
    ctx.arc(r * 0.35, -r * 0.15, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (kind === "lettuce") {
    const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#B4D493");
    grad.addColorStop(1, "#63813F");
    ctx.fillStyle = grad;
    ctx.beginPath();
    // Borde ondulado, no un círculo liso
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rad = r * (i % 2 === 0 ? 1 : 0.86);
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(70,95,45,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.2, r * 0.5, -r * 0.2);
    ctx.stroke();
    return;
  }

  if (kind === "bacon") {
    const grad = ctx.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, "#E2837A");
    grad.addColorStop(1, "#9E3227");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.3);
    ctx.quadraticCurveTo(0, -r * 0.9, r, -r * 0.2);
    ctx.quadraticCurveTo(0, r * 0.9, -r, r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(245,206,131,0.75)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.1);
    ctx.quadraticCurveTo(0, -r * 0.5, r * 0.6, 0);
    ctx.stroke();
    return;
  }

  // bun (pan)
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.2);
  grad.addColorStop(0, "#FFD98A");
  grad.addColorStop(1, "#CE9145");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,246,232,0.9)";
  const seeds: [number, number][] = [
    [-r * 0.3, -r * 0.2],
    [r * 0.1, -r * 0.4],
    [r * 0.35, 0],
  ];
  seeds.forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.ellipse(sx, sy, 1.8, 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}
