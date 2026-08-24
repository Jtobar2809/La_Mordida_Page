import { prisma } from "@/lib/prisma";
import { vigentesEn } from "@/lib/costos-fijos";

/**
 * Retiros de socios: la plata que los dueños sacan del negocio para vivir.
 *
 * Dos ideas que este archivo mantiene separadas a propósito:
 *
 *  - El **presupuesto** ($800.000/mes) es una meta. Vive en `CostoFijo` con
 *    `esRetiro = true` y es lo que usa el punto de equilibrio: hay que vender
 *    para poder sacarlo, se haya sacado o no.
 *  - Lo **retirado** es lo que de verdad salió del cajón, movimiento por
 *    movimiento. Es lo que la caja descuenta del cupo día a día.
 *
 * Ninguno de los dos es un gasto. En el estado de resultados el retiro va
 * DEBAJO de la utilidad: repartir la ganancia no es un costo de operar, y
 * restarlo antes haría ver el negocio menos rentable de lo que es.
 */

export type RetiroDelMes = {
  id: string;
  fecha: Date;
  monto: number;
  concepto: string;
  metodo: string;
  /** Turno del que salió, para poder rastrearlo hasta el arqueo. */
  sesionCodigo: string;
};

export type CupoRetiros = {
  anio: number;
  mes: number;
  /** Suma de los costos fijos marcados como retiro. 0 = nadie lo configuró. */
  presupuesto: number;
  hayPresupuesto: boolean;
  /** Lo que ya salió este mes, sin importar el medio de pago. */
  retirado: number;
  /** presupuesto − retirado. Negativo significa que se pasaron del cupo. */
  saldo: number;
  /** Cuánto se pasaron, o 0. Se expone aparte para no repetir el `Math.max`. */
  exceso: number;
  /** Porcentaje del cupo usado. Puede pasar de 100 y la UI lo pinta en rojo. */
  usadoPct: number;
  movimientos: RetiroDelMes[];
};

/**
 * La parte pura del cálculo, para poder probarla sin base de datos.
 *
 * Ojo con una limitación consciente: si alguien registra mal un retiro, la
 * corrección es un INGRESO al cajón, y ese ingreso NO devuelve cupo aquí. Es
 * el precio de que `monto` sea siempre positivo y el signo lo ponga el tipo;
 * el caso se resuelve con un retiro menos el día siguiente, no inventando
 * movimientos negativos que romperían el arqueo.
 */
export function calcularCupoRetiros(
  presupuesto: number,
  movimientos: RetiroDelMes[],
  anio: number,
  mes: number
): CupoRetiros {
  const retirado = movimientos.reduce((suma, m) => suma + m.monto, 0);
  const saldo = presupuesto - retirado;

  return {
    anio,
    mes,
    presupuesto,
    hayPresupuesto: presupuesto > 0,
    retirado,
    saldo,
    exceso: Math.max(0, -saldo),
    // Sin presupuesto no hay porcentaje que mostrar: dividir por cero daría
    // Infinity y una barra de progreso rota.
    usadoPct: presupuesto > 0 ? (retirado / presupuesto) * 100 : 0,
    movimientos,
  };
}

/** El cupo de un mes concreto, con el detalle de cada retiro. */
export async function obtenerCupoRetiros(anio: number, mes: number): Promise<CupoRetiros> {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  const [costos, movimientos] = await Promise.all([
    // El cupo del mes se mide contra el presupuesto que regía ESE mes: si los
    // socios subieron su retiro en junio, mayo no puede quedar de golpe "por
    // debajo del cupo" cuando se vuelva a abrir.
    prisma.costoFijo.aggregate({
      where: { esRetiro: true, ...vigentesEn(desde, hasta) },
      _sum: { monto: true },
    }),

    prisma.movimientoCaja.findMany({
      where: { tipo: "RETIRO", createdAt: { gte: desde, lt: hasta } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        monto: true,
        concepto: true,
        metodo: true,
        sesion: { select: { codigo: true } },
      },
    }),
  ]);

  const retiros: RetiroDelMes[] = movimientos.map((m) => ({
    id: m.id,
    fecha: m.createdAt,
    monto: m.monto,
    concepto: m.concepto,
    metodo: m.metodo,
    sesionCodigo: m.sesion.codigo,
  }));

  return calcularCupoRetiros(costos._sum?.monto ?? 0, retiros, anio, mes);
}

/** El cupo del mes en curso: lo que necesita la caja para decidir si avisa. */
export function obtenerCupoDelMesActual(hoy = new Date()) {
  return obtenerCupoRetiros(hoy.getFullYear(), hoy.getMonth() + 1);
}
