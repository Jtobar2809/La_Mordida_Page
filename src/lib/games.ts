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

  const sessions = await prisma.gameSession.findMany({
    where: { game, ...(since ? { createdAt: { gte: since } } : {}) },
    select: { userId: true, score: true, user: { select: { name: true, image: true } } },
    orderBy: { score: "desc" },
  });

  const bestByUser = new Map<string, LeaderboardEntry>();
  for (const s of sessions) {
    const existing = bestByUser.get(s.userId);
    if (!existing || s.score > existing.bestScore) {
      bestByUser.set(s.userId, {
        userId: s.userId,
        name: s.user.name ?? "Jugador anónimo",
        image: s.user.image,
        bestScore: s.score,
      });
    }
  }

  return Array.from(bestByUser.values())
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, limit);
}

/** Posición y mejor puntaje del usuario actual en el leaderboard, aunque no esté en el top visible */
export async function getUserRank(
  game: GameSlug,
  userId: string,
  period: LeaderboardPeriod = "all"
): Promise<{ rank: number; bestScore: number } | null> {
  const since = periodToDate(period);

  const sessions = await prisma.gameSession.findMany({
    where: { game, ...(since ? { createdAt: { gte: since } } : {}) },
    select: { userId: true, score: true },
    orderBy: { score: "desc" },
  });

  const bestByUser = new Map<string, number>();
  for (const s of sessions) {
    const current = bestByUser.get(s.userId) ?? -Infinity;
    if (s.score > current) bestByUser.set(s.userId, s.score);
  }

  const ranked = Array.from(bestByUser.entries()).sort((a, b) => b[1] - a[1]);
  const index = ranked.findIndex(([id]) => id === userId);
  if (index === -1) return null;

  const entry = ranked[index];
  if (!entry) return null;

  return { rank: index + 1, bestScore: entry[1] };
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
