/**
 * Qué costos fijos cuentan en qué mes.
 *
 * Un costo fijo no se edita en el tiempo, se versiona: cambiar el arriendo
 * cierra la fila vigente y abre otra. Este archivo es el único lugar que sabe
 * traducir "el mes de enero" a "qué filas aplican", para que el estado de
 * resultados, el cupo de retiros y el punto de equilibrio no puedan responder
 * cosas distintas a la misma pregunta.
 */

/**
 * El ancla de toda vigencia: el día 1 del mes. Un fijo se paga entero o no se
 * paga — prorratear el arriendo por días no describe nada real, y peor,
 * dejaría el mismo mes con dos filas del mismo costo sumando las dos.
 */
export function inicioDeMes(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

/**
 * Filtro de Prisma: las filas cuya vigencia se cruza con [desde, hasta).
 *
 * `vigenteHasta` es EXCLUSIVO y por eso la comparación es `gt` y no `gte`. Es
 * el detalle del que depende todo: cuando el arriendo sube, la fila vieja se
 * cierra el día 1 y la nueva abre el día 1. Con `gte` las dos caerían dentro
 * de ese mes y el arriendo se cobraría dos veces.
 */
export function vigentesEn(desde: Date, hasta: Date) {
  return {
    vigenteDesde: { lt: hasta },
    OR: [{ vigenteHasta: null }, { vigenteHasta: { gt: desde } }],
  };
}

/** La misma regla, en memoria, para poder probarla sin base de datos. */
export function estaVigenteEn(
  costo: { vigenteDesde: Date; vigenteHasta: Date | null },
  desde: Date,
  hasta: Date
) {
  if (costo.vigenteDesde >= hasta) return false;
  return costo.vigenteHasta === null || costo.vigenteHasta > desde;
}

/** Suma de los fijos vigentes en el mes, separando lo que es retiro de socios. */
export function repartirFijos(costos: { monto: number; esRetiro: boolean }[]) {
  let gastosFijos = 0;
  let retiroPresupuestado = 0;
  for (const c of costos) {
    if (c.esRetiro) retiroPresupuestado += c.monto;
    else gastosFijos += c.monto;
  }
  return { gastosFijos, retiroPresupuestado };
}
