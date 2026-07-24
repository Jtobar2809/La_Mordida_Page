"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { submitGameScore, getLeaderboard, getUserRank, type GameSlug, type LeaderboardPeriod } from "@/lib/games";
import type { ActionResult } from "@/actions/auth";

const GAME_SLUGS = [
  "atrapa-la-mordida",
  "reaccion-rapida",
  "mordi-runner",
  "torre-de-ingredientes",
  "combo-perfecto",
  "memorama-de-sabores",
  "salta-la-parrilla",
  "corta-los-ingredientes",
  "encesta-la-papa",
  "ruleta-de-la-suerte",
] as const;

const resultSchema = z.object({
  game: z.enum(GAME_SLUGS),
  score: z.number().int().min(0).max(10_000),
});

/**
 * Registra el resultado de una partida para el leaderboard. Requiere
 * sesión activa — sin login se puede jugar igual (ver el componente del
 * juego), simplemente no se guarda ni aparece en la tabla de posiciones.
 * Los minijuegos son puramente recreativos: esto no otorga ningún tipo
 * de punto de fidelización ni beneficio de negocio.
 */
export async function submitGameScoreAction(input: unknown): Promise<ActionResult<{ score: number }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Inicia sesión para guardar tu puntaje en la tabla de posiciones." };
  }

  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Resultado inválido." };
  }

  const result = await submitGameScore({
    userId: session.user.id,
    game: parsed.data.game as GameSlug,
    score: parsed.data.score,
  });

  return { success: true, data: { score: result.score } };
}

/** Top del leaderboard de un juego, más la posición del usuario actual si tiene sesión */
export async function getLeaderboardAction(game: GameSlug, period: LeaderboardPeriod = "all") {
  const session = await auth();

  const [top, userRank] = await Promise.all([
    getLeaderboard(game, period, 10),
    session?.user?.id ? getUserRank(game, session.user.id, period) : Promise.resolve(null),
  ]);

  return { top, userRank, currentUserId: session?.user?.id ?? null };
}
