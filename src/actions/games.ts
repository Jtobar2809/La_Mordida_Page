"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import {
  submitGameScore,
  getLeaderboard,
  getPlayerRank,
  createGuestPlayer,
  guestDisplayName,
  isValidGuestCode,
  playerKeyOf,
  type GameSlug,
  type LeaderboardPeriod,
  type PlayerIdentity,
} from "@/lib/games";
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

const GUEST_COOKIE = "lm_guest";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 años

/**
 * Resuelve quién está jugando.
 *
 * Con sesión iniciada, el jugador es el usuario. Sin sesión, se usa un
 * código de invitado guardado en una cookie httpOnly — así el jugador
 * conserva su identidad entre partidas y entre visitas sin registrarse,
 * y el código no se puede falsear desde el navegador.
 *
 * `create` distingue los dos usos: al guardar un puntaje sí queremos
 * emitir un código nuevo si no existe, pero al solo leer la tabla de
 * posiciones no — si no, cada visitante casual generaría un invitado
 * fantasma que nunca jugó.
 */
async function resolveIdentity(options: { create: boolean }): Promise<PlayerIdentity | null> {
  const session = await auth();
  if (session?.user?.id) return { kind: "user", userId: session.user.id };

  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing && isValidGuestCode(existing)) return { kind: "guest", guestCode: existing };

  if (!options.create) return null;

  const guestCode = await createGuestPlayer();
  store.set(GUEST_COOKIE, guestCode, {
    maxAge: GUEST_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return { kind: "guest", guestCode };
}

/**
 * Registra el resultado de una partida para el leaderboard. Ya no
 * requiere sesión: sin cuenta, el puntaje se guarda bajo una identidad
 * de invitado con código irrepetible, para que todo el mundo aparezca en
 * la tabla de posiciones. Los minijuegos son puramente recreativos: esto
 * no otorga ningún tipo de punto de fidelización ni beneficio de negocio.
 */
export async function submitGameScoreAction(
  input: unknown
): Promise<ActionResult<{ score: number; playerLabel: string; isGuest: boolean }>> {
  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Resultado inválido." };
  }

  const identity = await resolveIdentity({ create: true });
  if (!identity) {
    return { success: false, error: "No se pudo identificar al jugador." };
  }

  const result = await submitGameScore({
    identity,
    game: parsed.data.game as GameSlug,
    score: parsed.data.score,
  });

  return {
    success: true,
    data: {
      score: result.score,
      playerLabel: identity.kind === "guest" ? guestDisplayName(identity.guestCode) : "tu cuenta",
      isGuest: identity.kind === "guest",
    },
  };
}

/** Top del leaderboard de un juego, más la posición del jugador actual (registrado o invitado) */
export async function getLeaderboardAction(game: GameSlug, period: LeaderboardPeriod = "all") {
  const identity = await resolveIdentity({ create: false });
  const currentPlayerKey = identity ? playerKeyOf(identity) : null;

  const [top, playerRank] = await Promise.all([
    getLeaderboard(game, period, 10),
    currentPlayerKey ? getPlayerRank(game, currentPlayerKey, period) : Promise.resolve(null),
  ]);

  return {
    top,
    playerRank,
    currentPlayerKey,
    isGuest: identity?.kind === "guest",
  };
}
