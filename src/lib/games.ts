import { prisma } from "@/lib/prisma";

/**
 * Slugs de minijuegos soportados. Usar esta unión (en vez de string
 * suelto) en cualquier punto donde se identifique un juego, para que
 * TypeScript avise si se referencia un juego que no existe. Se amplía
 * a medida que se construye cada uno de los 10 minijuegos.
 */
export type GameSlug =
  | "atrapa-la-mordida"
  | "reaccion-rapida"
  | "mordi-runner"
  | "torre-de-ingredientes"
  | "combo-perfecto"
  | "memorama-de-sabores"
  | "salta-la-parrilla"
  | "corta-los-ingredientes"
  | "encesta-la-papa"
  | "ruleta-de-la-suerte";

const MAX_SCORE = 10_000; // cota defensiva contra payloads manipulados
const DUPLICATE_WINDOW_MS = 2000; // evita doble-submit accidental (doble click, reintento de red)

/**
 * Registra el resultado de una partida. Los minijuegos son puramente
 * recreativos — no otorgan puntos de fidelización — así que la única
 * validación server-side necesaria es defensiva: acotar el score a un
 * máximo razonable y evitar duplicados inmediatos. El resto del control
 * de "trampas" no aplica aquí, porque no hay ningún valor de negocio
 * en juego; el leaderboard es por diversión y transparencia comunitaria.
 */
export async function submitGameScore(params: { userId: string; game: GameSlug; score: number }) {
  const { userId, game } = params;
  const safeScore = Math.max(0, Math.min(Math.floor(params.score), MAX_SCORE));

  const recentDuplicate = await prisma.gameSession.findFirst({
    where: {
      userId,
      game,
      score: safeScore,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
  });
  if (recentDuplicate) return { saved: false, score: safeScore };

  await prisma.gameSession.create({ data: { userId, game, score: safeScore } });
  return { saved: true, score: safeScore };
}

export type LeaderboardPeriod = "today" | "week" | "all";

export type LeaderboardEntry = {
  userId: string;
  name: string;
  image: string | null;
  bestScore: number;
};

/**
 * Calcula el top de mejor puntaje por usuario para un juego, en una
 * ventana de tiempo. Usa el mejor score histórico de cada jugador
 * dentro de la ventana (no la suma de partidas), para que gane quien
 * mejor jugó, no quien más tiempo libre tuvo.
 */
export async function getLeaderboard(
  game: GameSlug,
  period: LeaderboardPeriod = "all",
  limit = 10
): Promise<LeaderboardEntry[]> {
  const since = periodToDate(period);

  // Optimized: group by userId to fetch max score per user, then batch-fetch user info.
  const grouped = await prisma.gameSession.groupBy({
    by: ["userId"],
    where: { game, ...(since ? { createdAt: { gte: since } } : {}) },
    _max: { score: true },
    orderBy: { _max: { score: "desc" } },
    take: limit,
  });

  const userIds = grouped.map((g) => g.userId);
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, image: true } });
  const usersMap = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g) => ({
    userId: g.userId,
    name: usersMap.get(g.userId)?.name ?? "Jugador anónimo",
    image: usersMap.get(g.userId)?.image ?? null,
    bestScore: g._max.score ?? 0,
  }));
}

/** Posición y mejor puntaje del usuario actual en el leaderboard, aunque no esté en el top visible */
export async function getUserRank(
  game: GameSlug,
  userId: string,
  period: LeaderboardPeriod = "all"
): Promise<{ rank: number; bestScore: number } | null> {
  const since = periodToDate(period);

  // Optimized: compute best score per user via groupBy, then sort to find rank.
  const grouped = await prisma.gameSession.groupBy({
    by: ["userId"],
    where: { game, ...(since ? { createdAt: { gte: since } } : {}) },
    _max: { score: true },
  });

  if (grouped.length === 0) return null;

  const ranked = grouped
    .map((g) => ({ userId: g.userId, bestScore: g._max.score ?? 0 }))
    .sort((a, b) => b.bestScore - a.bestScore);

  const index = ranked.findIndex((r) => r.userId === userId);
  if (index === -1) return null;
  const best = ranked[index];
  if (!best) return null;
  return { rank: index + 1, bestScore: best.bestScore };
}

function periodToDate(period: LeaderboardPeriod): Date | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  // week: últimos 7 días
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}
