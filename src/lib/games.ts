import { randomBytes } from "node:crypto";
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

// ── Identidad del jugador ──────────────────────────────────────────────

/**
 * Quién jugó la partida. Los invitados existen para que TODO el mundo
 * aparezca en la tabla de posiciones, no solo quien se registró: se les
 * asigna un código público irrepetible y compiten de igual a igual.
 */
export type PlayerIdentity =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestCode: string };

/**
 * Clave de agrupación del leaderboard. Prefijar el tipo de jugador
 * permite rankear registrados e invitados con un solo GROUP BY, sin
 * COALESCE ni UNION, y garantiza que un userId nunca colisione con un
 * guestCode.
 */
export function playerKeyOf(identity: PlayerIdentity): string {
  return identity.kind === "user" ? `u:${identity.userId}` : `g:${identity.guestCode}`;
}

// Alfabeto sin caracteres confundibles (0/O, 1/I/L): el código se muestra
// en pantalla y la gente lo dicta en voz alta para compararse con amigos.
const GUEST_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const GUEST_CODE_LENGTH = 6; // 32^6 ≈ 1.07e9 combinaciones

const GUEST_CODE_PATTERN = new RegExp(`^[${GUEST_ALPHABET}]{${GUEST_CODE_LENGTH}}$`);

export function isValidGuestCode(code: string): boolean {
  return GUEST_CODE_PATTERN.test(code);
}

function randomGuestCode(): string {
  // rejection sampling: 256 no es múltiplo de 32, pero 32 sí divide a 256,
  // así que el módulo aquí es uniforme (256 / 32 = 8 exacto).
  const bytes = randomBytes(GUEST_CODE_LENGTH);
  let code = "";
  for (const byte of bytes) code += GUEST_ALPHABET[byte % GUEST_ALPHABET.length];
  return code;
}

/**
 * Crea una identidad de invitado con código irrepetible.
 *
 * La unicidad no se confía al azar: `GuestPlayer.code` es la clave
 * primaria, así que es Postgres quien la garantiza. Si el insert choca
 * (error P2002 de Prisma), se reintenta con otro código. Con 1.07e9
 * combinaciones y una base de jugadores de barrio, el primer intento
 * acierta prácticamente siempre.
 */
export async function createGuestPlayer(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomGuestCode();
    try {
      await prisma.guestPlayer.create({ data: { code } });
      return code;
    } catch {
      // colisión (o carrera con otro insert): probamos con otro código
    }
  }
  throw new Error("No se pudo generar un código de invitado único");
}

/** Etiqueta pública de un invitado en la tabla de posiciones */
export function guestDisplayName(code: string): string {
  return `Anónimo #${code}`;
}

// ── Registro de partidas ───────────────────────────────────────────────

/**
 * Registra el resultado de una partida. Los minijuegos son puramente
 * recreativos — no otorgan puntos de fidelización — así que la única
 * validación server-side necesaria es defensiva: acotar el score a un
 * máximo razonable y evitar duplicados inmediatos. El resto del control
 * de "trampas" no aplica aquí, porque no hay ningún valor de negocio
 * en juego; el leaderboard es por diversión y transparencia comunitaria.
 */
export async function submitGameScore(params: { identity: PlayerIdentity; game: GameSlug; score: number }) {
  const { identity, game } = params;
  const playerKey = playerKeyOf(identity);
  const safeScore = Math.max(0, Math.min(Math.floor(params.score), MAX_SCORE));

  const recentDuplicate = await prisma.gameSession.findFirst({
    where: {
      playerKey,
      game,
      score: safeScore,
      createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
  });
  if (recentDuplicate) return { saved: false, score: safeScore };

  await prisma.gameSession.create({
    data: {
      playerKey,
      userId: identity.kind === "user" ? identity.userId : null,
      guestCode: identity.kind === "guest" ? identity.guestCode : null,
      game,
      score: safeScore,
    },
  });
  return { saved: true, score: safeScore };
}

// ── Tabla de posiciones ────────────────────────────────────────────────

export type LeaderboardPeriod = "today" | "week" | "all";

export type LeaderboardEntry = {
  playerKey: string;
  name: string;
  image: string | null;
  bestScore: number;
  isGuest: boolean;
};

/**
 * Calcula el top de mejor puntaje por jugador para un juego, en una
 * ventana de tiempo. Usa el mejor score histórico de cada jugador
 * dentro de la ventana (no la suma de partidas), para que gane quien
 * mejor jugó, no quien más tiempo libre tuvo. Registrados e invitados
 * compiten en la misma tabla.
 */
export async function getLeaderboard(
  game: GameSlug,
  period: LeaderboardPeriod = "all",
  limit = 10
): Promise<LeaderboardEntry[]> {
  const since = periodToDate(period);

  const grouped = await prisma.gameSession.groupBy({
    by: ["playerKey"],
    where: { game, ...(since ? { createdAt: { gte: since } } : {}) },
    _max: { score: true },
    orderBy: { _max: { score: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  // Solo hace falta resolver nombre/foto de los registrados: el nombre de
  // un invitado se deriva de su propio código.
  const userIds = grouped
    .map((g) => parsePlayerKey(g.playerKey))
    .filter((p): p is { kind: "user"; userId: string } => p?.kind === "user")
    .map((p) => p.userId);

  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, image: true },
        })
      : [];
  const usersMap = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g) => {
    const parsed = parsePlayerKey(g.playerKey);
    const bestScore = g._max.score ?? 0;

    if (parsed?.kind === "guest") {
      return { playerKey: g.playerKey, name: guestDisplayName(parsed.guestCode), image: null, bestScore, isGuest: true };
    }

    const user = parsed?.kind === "user" ? usersMap.get(parsed.userId) : undefined;
    return {
      playerKey: g.playerKey,
      name: user?.name ?? "Jugador",
      image: user?.image ?? null,
      bestScore,
      isGuest: false,
    };
  });
}

/** Posición y mejor puntaje del jugador actual, aunque no esté en el top visible */
export async function getPlayerRank(
  game: GameSlug,
  playerKey: string,
  period: LeaderboardPeriod = "all"
): Promise<{ rank: number; bestScore: number } | null> {
  const since = periodToDate(period);

  const grouped = await prisma.gameSession.groupBy({
    by: ["playerKey"],
    where: { game, ...(since ? { createdAt: { gte: since } } : {}) },
    _max: { score: true },
  });

  if (grouped.length === 0) return null;

  const ranked = grouped
    .map((g) => ({ playerKey: g.playerKey, bestScore: g._max.score ?? 0 }))
    .sort((a, b) => b.bestScore - a.bestScore);

  const index = ranked.findIndex((r) => r.playerKey === playerKey);
  if (index === -1) return null;
  const best = ranked[index];
  if (!best) return null;
  return { rank: index + 1, bestScore: best.bestScore };
}

function parsePlayerKey(playerKey: string): PlayerIdentity | null {
  if (playerKey.startsWith("u:")) return { kind: "user", userId: playerKey.slice(2) };
  if (playerKey.startsWith("g:")) return { kind: "guest", guestCode: playerKey.slice(2) };
  return null;
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
