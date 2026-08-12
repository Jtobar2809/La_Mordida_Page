"use client";

import * as React from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { Layers, Sparkles, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leaderboard } from "@/components/games/Leaderboard";
import { MordiSprite, type MordiExpression } from "@/components/games/MordiSprite";
import { GameLayout, GameResult, GameShell, GameStat } from "@/components/games/GameShell";
import { useScoreSubmit } from "@/components/games/useScoreSubmit";
import { levelFor, ramp } from "@/components/games/difficulty";
import { cn } from "@/lib/utils";

const GAME_SLUG = "torre-de-ingredientes";
const BEST_SCORE_KEY = "lm_game_best_torre-de-ingredientes";

// Secuencia de ingredientes que se repite en bucle a medida que crece la
// torre. Cada uno tiene un gradiente de 3 tonos (en vez de un color
// sólido plano) para dar sensación de volumen real, más un color de
// borde para la cara frontal del corte.
const INGREDIENTS = [
  { label: "Pan inferior", from: "#F7D79B", mid: "#E8B76B", to: "#C68A3E", height: 24, kind: "bun" },
  { label: "Carne", from: "#9A6042", mid: "#75422B", to: "#4A2718", height: 22, kind: "patty" },
  { label: "Queso", from: "#FDEB9C", mid: "#F5CE53", to: "#D99C23", height: 13, kind: "cheese" },
  { label: "Tomate", from: "#F2837A", mid: "#DC4E42", to: "#A82C24", height: 15, kind: "tomato" },
  { label: "Lechuga", from: "#B4D493", mid: "#8CB264", to: "#5E7A3C", height: 15, kind: "lettuce" },
  { label: "Pan superior", from: "#FBDFA9", mid: "#EFBB72", to: "#CE9145", height: 26, kind: "top" },
] as const;

// INGREDIENTS nunca está vacío (literal fijo de 6 elementos definido
// arriba), así que el índice 0 siempre existe. Única aserción no-null
// del archivo, usada como fallback para cualquier índice fuera de rango.
const FALLBACK_INGREDIENT = INGREDIENTS[0]!;

const BOARD_HEIGHT = 320; // alto fijo del tablero en px

// ── Dificultad progresiva ──
// Tres palancas suben con la altura de la torre: el ingrediente se
// mueve más rápido y recorre más distancia, la capa se hace más angosta
// (menos margen para acertar) y la tolerancia de "perfecto"/"bien" se
// estrecha. Todas tienen tope: pasado RAMP_OVER_LAYERS la torre es
// difícil pero sigue siendo jugable.
const RAMP_OVER_LAYERS = 18;
const BASE_SWING_MS = 1400; // duración de un ciclo completo de swing
const MIN_SWING_MS = 460; // piso de dificultad: no se acelera infinito
const WIDTH_SHRINK_TO = 0.62; // la capa llega a medir el 62% de su ancho inicial
const SWING_RANGE_GROWTH = 1.18; // el recorrido lateral se ensancha un 18%

// Sistema de "bamboleo" simulado (no es física real): cada mal
// aterrizaje suma inclinación acumulada a toda la torre; un buen
// aterrizaje la reduce. Pasado el umbral, la torre se derrumba.
// Las tolerancias son FRACCIONES del ancho de capa, no píxeles, porque
// el ancho es responsive (se adapta al tablero) y además encoge con la
// dificultad.
const PERFECT_RATIO_FROM = 0.03; // <3% de desalineación = clavado
const PERFECT_RATIO_TO = 0.015;
const GOOD_RATIO_FROM = 0.1; // <10% = aterrizaje limpio
const GOOD_RATIO_TO = 0.05;
const FALL_RATIO = 0.82; // >82% = casi no se apoya, se cae de una
const WOBBLE_PER_MISS = 30; // grados de inclinación por "1 ancho" de error
const WOBBLE_RECOVERY_PERFECT_FROM = 4;
const WOBBLE_RECOVERY_PERFECT_TO = 2.2;
const WOBBLE_RECOVERY_GOOD_FROM = 2;
const WOBBLE_RECOVERY_GOOD_TO = 0.9;
const WOBBLE_COLLAPSE_THRESHOLD = 26; // grados: a partir de aquí, se derrumba

type GameState = "idle" | "playing" | "finished";
/** `width` se guarda por capa: las ya colocadas conservan el ancho que tenían al caer */
type PlacedLayer = { offsetX: number; ingredientIndex: number; width: number };
type Feedback = { kind: "perfect" | "good"; id: number } | null;

/**
 * Minijuego "Torre de Ingredientes": un ingrediente se mueve de lado a
 * lado colgando de la grúa; al tocar, se suelta y se apila. Si el
 * desalineamiento con la capa anterior es grande, la torre acumula
 * "bamboleo" (un único valor de inclinación simulada, sin motor de
 * física); pasado el umbral, se derrumba. Cada capa acelera ligeramente
 * el swing, hasta un piso mínimo jugable.
 *
 * Dos correcciones respecto a la versión anterior:
 *
 * 1. Las capas colocadas se dibujaban con `style={{ transform:
 *    translateX(offsetX) }}` sobre un `motion.div` que a la vez animaba
 *    `y`. Framer Motion es dueño de la propiedad `transform` de un
 *    componente motion: generaba `translateY(0px)` y borraba el
 *    translateX inline, así que TODAS las capas se veían perfectamente
 *    centradas sin importar dónde se soltaran. Ahora el desplazamiento
 *    viaja como `x` dentro de initial/animate, que es la vía que Framer
 *    compone junto con `y`.
 *
 * 2. El bamboleo se calculaba como `misalignment * 2.2 * 0.01`, es decir
 *    0.022° por píxel: con un umbral de 26° y una recuperación de 1.5°
 *    por buen aterrizaje, la torre era matemáticamente incapaz de
 *    caerse. Ahora el error se mide como fracción del ancho de la capa
 *    (independiente del tamaño de pantalla) y un desalineamiento total
 *    tumba la torre de inmediato.
 */
export function TorreDeIngredientes() {
  const { submit, leaderboardKey, savedAs } = useScoreSubmit(GAME_SLUG);
  const [state, setState] = React.useState<GameState>("idle");
  const [layers, setLayers] = React.useState<PlacedLayer[]>([]);
  const [wobble, setWobble] = React.useState(0);
  const [feedback, setFeedback] = React.useState<Feedback>(null);
  const [perfectStreak, setPerfectStreak] = React.useState(0);
  const [collapsed, setCollapsed] = React.useState(false);
  const [boardWidth, setBoardWidth] = React.useState(320);
  const [bestScore, setBestScore] = React.useState(0);
  const [isNewRecord, setIsNewRecord] = React.useState(false);

  const boardRef = React.useRef<HTMLDivElement>(null);
  const rafId = React.useRef(0);
  const feedbackTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackId = React.useRef(0);

  const score = layers.length;
  const currentIngredient = INGREDIENTS[score % INGREDIENTS.length] ?? FALLBACK_INGREDIENT;

  // ── Geometría responsive + dificultad ──
  // El ancho base sale del tablero real (móvil vs escritorio) y encoge a
  // medida que la torre crece; el recorrido lateral se ensancha con lo
  // que sobra, así que apuntar cuesta cada vez más.
  const baseWidth = Math.max(92, Math.min(176, boardWidth * 0.44));
  const layerWidth = Math.round(baseWidth * ramp(score, 1, WIDTH_SHRINK_TO, RAMP_OVER_LAYERS));
  const swingRange = Math.min(
    (boardWidth - layerWidth) / 2 - 6,
    Math.max(36, ((boardWidth - baseWidth) / 2 - 8) * ramp(score, 1, SWING_RANGE_GROWTH, RAMP_OVER_LAYERS))
  );

  // El swing vive en un MotionValue, no en state: mover la pieza a 60fps
  // con setState re-renderizaría toda la torre en cada frame.
  const swingMv = useMotionValue(0);
  const swingXRef = React.useRef(0);
  const swingRangeRef = React.useRef(swingRange);
  const swingDurationRef = React.useRef(BASE_SWING_MS);
  swingRangeRef.current = swingRange;
  swingDurationRef.current = ramp(score, BASE_SWING_MS, MIN_SWING_MS, RAMP_OVER_LAYERS);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(BEST_SCORE_KEY);
      if (stored) setBestScore(Number(stored) || 0);
    } catch {
      // sin persistencia local, no es crítico
    }
  }, []);

  // Mide el tablero para adaptar el tamaño de las capas al ancho real
  React.useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const update = () => setBoardWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Loop del swing horizontal ──
  // Acumula la fase (en vez de derivarla del tiempo absoluto) para que un
  // cambio de velocidad no produzca un salto de posición.
  React.useEffect(() => {
    if (state !== "playing") return;

    let phase = 0;
    let last = 0;

    function tick(t: number) {
      if (!last) last = t;
      const dt = Math.min(t - last, 100); // clamp: la pestaña pudo perder foco
      last = t;
      phase = (phase + dt / swingDurationRef.current) % 1;
      const x = Math.sin(phase * Math.PI * 2) * swingRangeRef.current;
      swingXRef.current = x;
      swingMv.set(x);
      rafId.current = requestAnimationFrame(tick);
    }

    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [state, swingMv]);

  function startGame() {
    setLayers([]);
    setWobble(0);
    setPerfectStreak(0);
    setCollapsed(false);
    setIsNewRecord(false);
    setFeedback(null);
    swingXRef.current = 0;
    swingMv.set(0);
    setState("playing");
  }

  function drop() {
    if (state !== "playing") return;

    const previousOffset = layers.length > 0 ? (layers[layers.length - 1]?.offsetX ?? 0) : 0;
    const dropX = swingXRef.current;
    const misalignment = Math.abs(dropX - previousOffset);
    const missRatio = misalignment / layerWidth;

    // Se pasó por completo: la capa no se apoya en nada y la torre cae
    if (missRatio > FALL_RATIO) {
      setLayers((l) => [
        ...l,
        { offsetX: dropX, ingredientIndex: l.length % INGREDIENTS.length, width: layerWidth },
      ]);
      setCollapsed(true);
      endGame(layers.length);
      return;
    }

    // Las ventanas de acierto se estrechan con la altura
    const perfectRatio = ramp(score, PERFECT_RATIO_FROM, PERFECT_RATIO_TO, RAMP_OVER_LAYERS);
    const goodRatio = ramp(score, GOOD_RATIO_FROM, GOOD_RATIO_TO, RAMP_OVER_LAYERS);

    let wobbleDelta: number;
    let landedX = dropX;

    if (missRatio <= perfectRatio) {
      // Clavado: se alinea solo con la capa anterior. El "snap" es lo que
      // hace que un acierto perfecto se sienta perfecto.
      landedX = previousOffset;
      wobbleDelta = -ramp(score, WOBBLE_RECOVERY_PERFECT_FROM, WOBBLE_RECOVERY_PERFECT_TO, RAMP_OVER_LAYERS);
      setPerfectStreak((p) => p + 1);
      showFeedback("perfect");
    } else if (missRatio <= goodRatio) {
      wobbleDelta = -ramp(score, WOBBLE_RECOVERY_GOOD_FROM, WOBBLE_RECOVERY_GOOD_TO, RAMP_OVER_LAYERS);
      setPerfectStreak(0);
      showFeedback("good");
    } else {
      wobbleDelta = (missRatio - goodRatio) * WOBBLE_PER_MISS;
      setPerfectStreak(0);
    }

    const newLayers = [
      ...layers,
      { offsetX: landedX, ingredientIndex: layers.length % INGREDIENTS.length, width: layerWidth },
    ];
    setLayers(newLayers);

    const nextWobble = Math.max(0, wobble + wobbleDelta);
    setWobble(nextWobble);

    if (nextWobble >= WOBBLE_COLLAPSE_THRESHOLD) {
      setCollapsed(true);
      endGame(newLayers.length);
    }
  }

  function showFeedback(kind: "perfect" | "good") {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    setFeedback({ kind, id: feedbackId.current++ });
    feedbackTimeout.current = setTimeout(() => setFeedback(null), 700);
  }

  function endGame(finalScore: number) {
    cancelAnimationFrame(rafId.current);
    setState("finished");

    if (finalScore > bestScore) {
      setBestScore(finalScore);
      setIsNewRecord(true);
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(finalScore));
      } catch {
        // sin persistencia local, no es crítico
      }
    }

    submit(finalScore);
  }

  React.useEffect(() => {
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  // ── Cámara: cuando la torre supera la altura visible, se desplaza hacia abajo ──
  const stackHeight = layers.reduce(
    (sum, l) => sum + (INGREDIENTS[l.ingredientIndex] ?? FALLBACK_INGREDIENT).height,
    0
  );
  const cameraY = Math.max(0, stackHeight - (BOARD_HEIGHT - 132));

  const running = state === "playing";
  const previousOffsetForGuide = layers.length > 0 ? (layers[layers.length - 1]?.offsetX ?? 0) : 0;

  const mordiMood: MordiExpression =
    state === "finished"
      ? isNewRecord
        ? "love"
        : "dizzy"
      : running
        ? perfectStreak >= 3
          ? "cool"
          : "determined"
        : "happy";

  return (
    <GameLayout>
      <GameShell
        title="TORRE DE INGREDIENTES"
        subtitle="Suelta cada ingrediente cuando esté centrado. Los aciertos perfectos enderezan la torre; los torcidos la tumban."
        mordi={mordiMood}
        bareBoard
        hud={
          <>
            <GameStat icon={<Layers className="h-4 w-4" />} label="Capas" value={score} />
            <GameStat
              icon={<Star className="h-4 w-4" />}
              label="Perfectas"
              value={`x${perfectStreak}`}
              tone={perfectStreak >= 3 ? "gold" : "neutral"}
            />
            <GameStat
              icon={<TrendingUp className="h-4 w-4" />}
              label="Nivel"
              value={levelFor(score, 3)}
              tone={score >= 9 ? "ember" : "neutral"}
            />
            <GameStat
              label="Estabilidad"
              value={`${Math.max(0, Math.round(100 - (wobble / WOBBLE_COLLAPSE_THRESHOLD) * 100))}%`}
              tone={wobble > WOBBLE_COLLAPSE_THRESHOLD * 0.6 ? "danger" : "neutral"}
            />
          </>
        }
        footer={
          state === "finished" ? (
            <GameResult
              isNewRecord={isNewRecord}
              headline={`${score} ${score === 1 ? "capa" : "capas"}`}
              detail={collapsed ? "¡Se derrumbó la torre!" : undefined}
              bestLabel={bestScore > 0 ? `Tu récord personal: ${bestScore} capas` : undefined}
              savedAs={savedAs}
              onReplay={startGame}
            />
          ) : running ? (
            <Button onClick={drop} size="lg" className="w-full">
              Soltar ingrediente
            </Button>
          ) : (
            <Button onClick={startGame} size="lg" className="w-full">
              Jugar
            </Button>
          )
        }
      >
        <div
          ref={boardRef}
          role={running ? "button" : undefined}
          tabIndex={running ? 0 : -1}
          onClick={running ? drop : undefined}
          onKeyDown={(e) => {
            if (running && (e.key === " " || e.key === "Enter")) {
              e.preventDefault();
              drop();
            }
          }}
          className={cn(
            "relative w-full touch-none select-none overflow-hidden rounded-2xl",
            running && "cursor-pointer"
          )}
          style={{
            height: BOARD_HEIGHT,
            background: "radial-gradient(120% 90% at 50% 0%, #3A2519 0%, #241711 45%, #140D08 100%)",
          }}
        >
          {/* Brasa ambiental al fondo */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
            style={{ background: "radial-gradient(80% 100% at 50% 100%, rgba(232,92,43,0.28) 0%, rgba(232,92,43,0) 70%)" }}
          />

          {/* Riel de la grúa */}
          {running && (
            <>
              <div className="absolute inset-x-3 top-5 h-2 rounded-full bg-charcoal-600/70 shadow-inner" />
              {/* `x` es la única propiedad de transform aquí: el centrado se
                  resuelve con left+marginLeft (layout), no con translateX,
                  para no pelear con el MotionValue del swing. */}
              <motion.div
                className="absolute top-3 z-20 flex flex-col items-center"
                style={{ x: swingMv, left: "50%", marginLeft: -layerWidth / 2, width: layerWidth }}
              >
                {/* Carro + cuerda */}
                <div className="h-3 w-8 rounded-sm bg-charcoal-500 shadow" />
                <div className="h-6 w-[2px] bg-charcoal-400/80" />
                <IngredientSlab
                  ingredient={currentIngredient}
                  width={layerWidth}
                  className="shadow-[0_8px_20px_rgba(0,0,0,0.55)]"
                />
              </motion.div>

              {/* Guía de aterrizaje: marca dónde quedó el borde de la capa anterior */}
              <div
                className="pointer-events-none absolute bottom-4 z-10 border-x border-dashed border-mustard-300/35"
                style={{
                  left: `calc(50% + ${previousOffsetForGuide - layerWidth / 2}px)`,
                  width: layerWidth,
                  height: BOARD_HEIGHT - 90,
                }}
              />
            </>
          )}

          {/* Plato / base */}
          <div className="absolute inset-x-6 bottom-3 h-3 rounded-full bg-gradient-to-b from-charcoal-500 to-charcoal-800 shadow-lg" />

          {/* La torre */}
          <motion.div
            className="absolute bottom-5 left-1/2 z-10 flex flex-col-reverse items-center"
            animate={
              collapsed
                ? // Cae hacia el lado donde quedó la última capa
                  { rotate: previousOffsetForGuide >= 0 ? 78 : -78, y: cameraY + 90, opacity: 0.25 }
                : { rotate: wobble, x: wobble * 1.2, y: cameraY }
            }
            transition={
              collapsed
                ? { duration: 0.7, ease: "easeIn" }
                : { type: "spring", stiffness: 130, damping: 12 }
            }
            style={{ transformOrigin: "bottom center", marginLeft: -layerWidth / 2 }}
          >
            {layers.map((layer, i) => {
              const ingredient = INGREDIENTS[layer.ingredientIndex] ?? FALLBACK_INGREDIENT;
              return (
                <motion.div
                  key={i}
                  // El desplazamiento horizontal viaja como `x` dentro de
                  // initial/animate: Framer es dueño de `transform` y borraría
                  // cualquier translateX puesto por `style`.
                  initial={{ y: -70, opacity: 0, x: layer.offsetX }}
                  animate={{ y: 0, opacity: 1, x: layer.offsetX }}
                  transition={{ type: "spring", stiffness: 340, damping: 20 }}
                >
                  <IngredientSlab ingredient={ingredient} width={layer.width} />
                </motion.div>
              );
            })}
          </motion.div>

          {/* Mordi mirando la torre desde el borde */}
          <div className="pointer-events-none absolute bottom-2 right-2 z-20 h-14 w-14 opacity-90">
            <MordiSprite
              expression={collapsed ? "dizzy" : perfectStreak >= 3 ? "love" : running ? "surprised" : "happy"}
              animate={!running}
              className="h-full w-full"
            />
          </div>

          {/* Feedback de aterrizaje */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                key={feedback.id}
                initial={{ scale: 0.5, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: -14 }}
                exit={{ opacity: 0, y: -34 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-1.5 font-display text-lg tracking-wide shadow-lg",
                  feedback.kind === "perfect"
                    ? "bg-mustard-400 text-charcoal-900"
                    : "bg-ember-500 text-white"
                )}
              >
                <Sparkles className="h-4 w-4" />
                {feedback.kind === "perfect" ? "¡PERFECTO!" : "¡BIEN!"}
              </motion.div>
            )}
          </AnimatePresence>

          {state === "idle" && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-charcoal-900/55 text-cream backdrop-blur-[2px]">
              <div className="h-16 w-16">
                <MordiSprite expression="happy" glow className="h-full w-full" />
              </div>
              <p className="font-display text-lg tracking-wide">Arma la torre más alta</p>
              <p className="text-xs text-charcoal-200">Toca el tablero o el botón para soltar</p>
            </div>
          )}
        </div>
      </GameShell>

      <Leaderboard game={GAME_SLUG} refreshKey={leaderboardKey} />
    </GameLayout>
  );
}

/**
 * Una capa de la torre. Se dibuja como una losa con cara superior clara,
 * cuerpo con gradiente y borde inferior oscuro, para que se lea como un
 * corte real de ingrediente y no como un rectángulo de color.
 */
function IngredientSlab({
  ingredient,
  width,
  className,
}: {
  ingredient: (typeof INGREDIENTS)[number];
  width: number;
  className?: string;
}) {
  const isTopBun = ingredient.kind === "top";
  const isBottomBun = ingredient.kind === "bun";

  return (
    <div
      className={cn("relative", className)}
      style={{
        width,
        height: ingredient.height,
        borderRadius: isTopBun ? `${ingredient.height}px ${ingredient.height}px 5px 5px` : isBottomBun ? "5px 5px 10px 10px" : 5,
        background: `linear-gradient(180deg, ${ingredient.from} 0%, ${ingredient.mid} 55%, ${ingredient.to} 100%)`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 3px rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      {/* Sésamo del pan superior */}
      {isTopBun && (
        <>
          <span className="absolute left-[24%] top-[28%] h-[3px] w-[6px] -rotate-12 rounded-full bg-white/80" />
          <span className="absolute left-1/2 top-[18%] h-[3px] w-[6px] -translate-x-1/2 rounded-full bg-white/80" />
          <span className="absolute right-[24%] top-[28%] h-[3px] w-[6px] rotate-12 rounded-full bg-white/80" />
        </>
      )}
      {/* Borde ondulado de la lechuga */}
      {ingredient.kind === "lettuce" && (
        <div
          className="absolute inset-x-0 -bottom-1 h-2"
          style={{
            background: `radial-gradient(circle at 6px 0, ${ingredient.to} 5px, transparent 5px) 0 0/12px 8px repeat-x`,
          }}
        />
      )}
      {/* Brillo del queso */}
      {ingredient.kind === "cheese" && (
        <div className="absolute inset-x-2 top-[2px] h-[2px] rounded-full bg-white/60" />
      )}
      {/* Marcas de parrilla en la carne */}
      {ingredient.kind === "patty" && (
        <div
          className="absolute inset-0 rounded-[5px] opacity-40"
          style={{
            background: "repeating-linear-gradient(90deg, rgba(0,0,0,0.45) 0 3px, transparent 3px 22px)",
          }}
        />
      )}
    </div>
  );
}
