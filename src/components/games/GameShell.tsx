"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MordiSprite, type MordiExpression } from "@/components/games/MordiSprite";
import type { SavedAs } from "@/components/games/useScoreSubmit";
import { cn } from "@/lib/utils";

/**
 * Sistema visual compartido de los minijuegos (v2).
 *
 * Antes cada juego pintaba su propia Card con su propio encabezado y su
 * propio bloque de resultado, así que ocho juegos se veían como ocho
 * productos distintos. Este módulo centraliza el "chasis": encabezado
 * oscuro con brasa ambiental, mascota que reacciona al estado, fila de
 * indicadores tipo HUD, marco del tablero elevado y panel de resultado.
 * Cada juego solo aporta su tablero y sus acciones.
 *
 * Todo el ambiente (resplandores, viñeta, textura) es CSS estático: no
 * hay animaciones en bucle sobre el marco, para no robarle frames al
 * loop de juego que corre dentro.
 */

// ── Layout general: tablero + tabla de posiciones ──────────────────────

export function GameLayout({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  /** `wide` da más espacio al tablero (juegos verticales tipo canvas) */
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid max-w-4xl grid-cols-1 gap-6 lg:items-start",
        wide ? "lg:grid-cols-[0.9fr_1fr]" : "lg:grid-cols-[1.1fr_0.9fr]"
      )}
    >
      {children}
    </div>
  );
}

// ── Chasis del juego ───────────────────────────────────────────────────

interface GameShellProps {
  title: string;
  subtitle: string;
  /** Indicadores del HUD (usa <GameStat/>) */
  hud?: React.ReactNode;
  /** Expresión de la mascota en el encabezado, según el estado del juego */
  mordi?: MordiExpression;
  /** El tablero */
  children: React.ReactNode;
  /** Botones / panel de resultado */
  footer?: React.ReactNode;
  /** Quita el relleno blanco del marco (para tableros que ya traen su propio fondo, como los canvas) */
  bareBoard?: boolean;
  boardClassName?: string;
}

export function GameShell({
  title,
  subtitle,
  hud,
  mordi = "happy",
  children,
  footer,
  bareBoard = false,
  boardClassName,
}: GameShellProps) {
  return (
    <Card className="overflow-hidden p-0">
      <header className="relative isolate overflow-hidden bg-char-gradient px-5 pb-16 pt-5 text-cream sm:px-6">
        {/* Brasas ambientales: dos resplandores estáticos, sin costo de animación */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full opacity-70"
          style={{ background: "radial-gradient(circle, rgba(232,92,43,0.45) 0%, rgba(232,92,43,0) 68%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 top-10 h-48 w-48 rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(240,169,58,0.4) 0%, rgba(240,169,58,0) 70%)" }}
        />

        <div className="relative flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ember-300">Minijuego</p>
            <h3 className="mt-1 font-display text-2xl leading-tight tracking-wide sm:text-3xl">{title}</h3>
            <div className="mt-2 h-[3px] w-14 rounded-full bg-ember-gradient" />
            <p className="mt-2.5 max-w-sm text-sm leading-snug text-charcoal-200">{subtitle}</p>
          </div>

          {/* Mascota: cambia de expresión con el estado del juego */}
          {/* mode="wait": el sprite saliente se desmonta antes de montar el
              nuevo, así el header nunca reserva espacio para dos mascotas. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mordi}
              initial={{ scale: 0.6, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className="hidden h-20 w-20 shrink-0 sm:block"
            >
              <MordiSprite expression={mordi} glow className="h-full w-full" />
            </motion.div>
          </AnimatePresence>
        </div>

        {hud && <div className="relative mt-4 flex flex-wrap items-center gap-2">{hud}</div>}
      </header>

      {/* Tablero, solapado sobre el encabezado oscuro */}
      <div className="-mt-11 px-4 sm:px-5">
        <div
          className={cn(
            "relative rounded-2xl shadow-premium ring-1 ring-black/5",
            bareBoard
              ? "overflow-hidden bg-charcoal-900"
              : "bg-white p-3 dark:bg-charcoal-800 dark:ring-white/5",
            boardClassName
          )}
        >
          {children}
        </div>
      </div>

      <div className="px-5 pb-5 pt-4 sm:px-6">{footer}</div>
    </Card>
  );
}

// ── Indicador del HUD ──────────────────────────────────────────────────

export function GameStat({
  icon,
  label,
  value,
  tone = "neutral",
  className,
}: {
  icon?: React.ReactNode;
  label?: string;
  value: React.ReactNode;
  tone?: "neutral" | "ember" | "gold" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold backdrop-blur-sm ring-1",
        tone === "neutral" && "bg-white/10 text-cream ring-white/15",
        tone === "ember" && "bg-ember-500/20 text-ember-200 ring-ember-400/40",
        tone === "gold" && "bg-mustard-400/20 text-mustard-200 ring-mustard-300/40",
        tone === "danger" && "bg-red-500/20 text-red-200 ring-red-400/40",
        className
      )}
    >
      {icon}
      {label && <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</span>}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

/** Barra de tiempo/progreso para el HUD. `value` va de 0 a 1. */
export function GameMeter({ value, tone = "ember" }: { value: number; tone?: "ember" | "gold" | "danger" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/25">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-100 ease-linear",
          tone === "ember" && "bg-ember-gradient",
          tone === "gold" && "bg-mustard-400",
          tone === "danger" && "bg-red-500"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Panel de resultado, idéntico en los 8 juegos ───────────────────────

export function GameResult({
  isNewRecord,
  headline,
  detail,
  bestLabel,
  savedAs,
  onReplay,
  replayLabel = "Jugar de nuevo",
}: {
  isNewRecord: boolean;
  /** Resultado principal, ej. "12 puntos" */
  headline: React.ReactNode;
  /** Línea secundaria opcional, ej. "¡Sin más movimientos!" */
  detail?: React.ReactNode;
  /** Récord personal, ej. "Tu récord personal: 18" */
  bestLabel?: React.ReactNode;
  /** Bajo qué identidad quedó registrado el puntaje (devuelto por useScoreSubmit) */
  savedAs?: SavedAs | null;
  onReplay: () => void;
  replayLabel?: string;
}) {
  return (
    <div className="space-y-3 text-center">
      <AnimatePresence mode="wait">
        {isNewRecord ? (
          <motion.div
            key="record"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            className="flex flex-col items-center gap-1.5"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mustard-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-mustard-500 ring-1 ring-mustard-300/40">
              <Sparkles className="h-3.5 w-3.5" /> ¡Nuevo récord!
            </span>
            <p className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">{headline}</p>
          </motion.div>
        ) : (
          <motion.div key="normal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {detail && <p className="text-sm text-charcoal-500 dark:text-charcoal-300">{detail}</p>}
            <p className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">{headline}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {!isNewRecord && bestLabel && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-charcoal-400">
          <Trophy className="h-3.5 w-3.5 text-mustard-400" />
          {bestLabel}
        </p>
      )}
      {savedAs?.isGuest && (
        <p className="text-xs text-charcoal-400">
          Guardado en la tabla como{" "}
          <span className="font-mono font-bold text-ember-500">{savedAs.label}</span>. Inicia sesión para competir con
          tu nombre.
        </p>
      )}

      <Button onClick={onReplay} size="lg" className="w-full">
        {replayLabel}
      </Button>
    </div>
  );
}

// ── Capa superpuesta sobre tableros de canvas ──────────────────────────

export function GameOverlay({
  children,
  mordi,
}: {
  children: React.ReactNode;
  mordi?: MordiExpression;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-charcoal-900/60 px-6 text-center text-cream backdrop-blur-[2px]"
    >
      {mordi && (
        <motion.div
          initial={{ scale: 0.7, y: 8, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className="h-16 w-16"
        >
          <MordiSprite expression={mordi} glow className="h-full w-full" />
        </motion.div>
      )}
      {children}
    </motion.div>
  );
}
