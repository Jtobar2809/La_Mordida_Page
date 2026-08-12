/**
 * Curvas de dificultad compartidas por los minijuegos.
 *
 * Todos los juegos escalan con el avance de la partida — ventanas más
 * cortas, más objetos a la vez, menos tolerancia — pero cada uno lo hacía
 * (o no lo hacía) a su manera. Centralizar la interpolación evita que
 * cada archivo reinvente su propio `Math.min(base - n * paso, piso)` y
 * hace explícito el contrato: "de A hasta B a lo largo de N unidades de
 * avance, y de ahí en adelante se queda en B".
 */

/**
 * Interpola linealmente de `from` a `to` a medida que `progress` recorre
 * 0..`over`. Más allá de `over` devuelve `to` (la dificultad tiene techo:
 * un juego que acelera sin límite deja de ser jugable y pasa a ser
 * aleatorio). Funciona igual para rampas ascendentes y descendentes.
 */
export function ramp(progress: number, from: number, to: number, over: number): number {
  if (over <= 0) return to;
  const t = Math.max(0, Math.min(1, progress / over));
  return from + (to - from) * t;
}

/**
 * Nivel visible en el HUD (1..max). Sirve para que el jugador *sienta*
 * la escalada en vez de solo sufrirla: ver "Nivel 4" explica por qué de
 * pronto todo va más rápido.
 */
export function levelFor(progress: number, per: number, max = 9): number {
  if (per <= 0) return 1;
  return Math.max(1, Math.min(max, Math.floor(progress / per) + 1));
}

/**
 * Probabilidad de que ocurra un evento de dificultad (aparecer un
 * señuelo, spawnear dos objetos, hacer un amago), escalando con el
 * avance. Se recorta a [0, maxChance] para que nunca sea seguro.
 */
export function chanceFor(progress: number, startsAt: number, maxChance: number, over: number): number {
  if (progress < startsAt) return 0;
  return ramp(progress - startsAt, 0, maxChance, over);
}
