import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ESTADOS_VENTA_CONFIRMADA, obtenerPerdidas } from "@/lib/inventario";

/**
 * Estado de resultados de un mes.
 *
 * La distinción que ordena todo este archivo: **lo que compras no es lo que
 * gastas**. Si en agosto compras $2.000.000 de carne y usas $800.000, tu costo
 * de venta es $800.000 — el resto sigue siendo tuyo, está en la nevera. Restar
 * las compras de las ventas es el error que hace concluir que se perdió plata
 * el mes en que se llenó la despensa.
 *
 * Por eso los insumos entran por lo CONSUMIDO (MovimientoInsumo), nunca por lo
 * comprado, y `Gasto` existe solo para lo que no es insumo. Las compras del mes
 * se calculan igual, pero se muestran aparte y como lo que son: plata que salió
 * del banco, no costo del período.
 */

const estadosConfirmados = ESTADOS_VENTA_CONFIRMADA as OrderStatus[];

export type LineaGasto = { etiqueta: string; monto: number };

export type EstadoResultados = {
  anio: number;
  mes: number;
  esMesEnCurso: boolean;

  ventas: number;
  pedidos: number;

  costoVenta: number;
  utilidadBruta: number;
  margenBrutoPct: number;

  gastosFijos: number;
  gastosDelMes: number;
  mermas: number;
  totalGastos: number;

  utilidadNeta: number;
  margenNetoPct: number;

  /** Va debajo de la utilidad: repartir la ganancia no es un costo de operar. */
  retiro: number;
  quedaEnNegocio: number;

  /** Desglose para el gráfico de a dónde se va la plata. */
  detalleGastos: LineaGasto[];

  /**
   * Plata que salió a proveedores este mes. NO es costo del período — parte
   * quedó en inventario. Se muestra aparte justamente para poder explicarlo.
   */
  comprasDelMes: number;
  /** Cuánto de lo comprado no se consumió (o al revés, si se comió despensa). */
  variacionInventario: number;
};

export async function obtenerEstadoResultados(anio: number, mes: number): Promise<EstadoResultados> {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);
  const ahora = new Date();
  const esMesEnCurso = ahora >= desde && ahora < hasta;

  const rango = { gte: desde, lt: hasta };

  const [ventasAgg, movimientos, costosFijos, gastos, compras, perdidas] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: estadosConfirmados }, createdAt: rango },
      _sum: { total: true },
      _count: { _all: true },
    }),

    // SALIDA menos ENTRADA: cancelar un pedido crea una entrada que compensa su
    // salida, y contar solo las salidas metía la comida de pedidos cancelados
    // dentro del costo de venta.
    prisma.movimientoInsumo.findMany({
      where: { tipo: { in: ["SALIDA", "ENTRADA"] }, orderId: { not: null }, createdAt: rango },
      include: { insumo: { select: { costoUnitario: true } } },
    }),

    prisma.costoFijo.findMany({ where: { activo: true }, select: { nombre: true, monto: true, esRetiro: true } }),

    prisma.gasto.findMany({ where: { fecha: rango }, select: { categoria: true, monto: true } }),

    prisma.compra.aggregate({ where: { fecha: rango }, _sum: { total: true } }),

    obtenerPerdidas(desde),
  ]);

  const ventas = ventasAgg._sum?.total ?? 0;
  const pedidos = ventasAgg._count._all;

  const costoVenta = movimientos.reduce((sum, m) => {
    const costo = m.cantidad * (m.costoUnitario ?? m.insumo.costoUnitario);
    return m.tipo === "ENTRADA" ? sum - costo : sum + costo;
  }, 0);

  const utilidadBruta = ventas - costoVenta;

  const retiro = costosFijos.filter((c) => c.esRetiro).reduce((s, c) => s + c.monto, 0);
  const gastosFijos = costosFijos.filter((c) => !c.esRetiro).reduce((s, c) => s + c.monto, 0);

  const gastosDelMes = gastos.reduce((s, g) => s + g.monto, 0);

  // obtenerPerdidas filtra desde una fecha pero no hasta; el mes en curso no
  // necesita el recorte, un mes pasado sí.
  const mermas = perdidas.movimientos
    .filter((m) => m.createdAt >= desde && m.createdAt < hasta)
    .reduce((s, m) => s + perdidas.costoDe(m), 0);

  const totalGastos = gastosFijos + gastosDelMes + mermas;
  const utilidadNeta = utilidadBruta - totalGastos;

  const comprasDelMes = compras._sum?.total ?? 0;

  // Agrupado por categoría, más los fijos como una línea, para el gráfico.
  const porCategoria = new Map<string, number>();
  for (const g of gastos) {
    porCategoria.set(ETIQUETA_GASTO[g.categoria] ?? g.categoria, (porCategoria.get(ETIQUETA_GASTO[g.categoria] ?? g.categoria) ?? 0) + g.monto);
  }
  const detalleGastos: LineaGasto[] = [
    ...costosFijos.filter((c) => !c.esRetiro).map((c) => ({ etiqueta: c.nombre, monto: c.monto })),
    ...[...porCategoria].map(([etiqueta, monto]) => ({ etiqueta, monto })),
    ...(mermas > 0 ? [{ etiqueta: "Mermas y pérdidas", monto: mermas }] : []),
  ]
    .filter((l) => l.monto > 0)
    .sort((a, b) => b.monto - a.monto);

  return {
    anio,
    mes,
    esMesEnCurso,
    ventas,
    pedidos,
    costoVenta,
    utilidadBruta,
    margenBrutoPct: ventas > 0 ? (utilidadBruta / ventas) * 100 : 0,
    gastosFijos,
    gastosDelMes,
    mermas,
    totalGastos,
    utilidadNeta,
    margenNetoPct: ventas > 0 ? (utilidadNeta / ventas) * 100 : 0,
    retiro,
    quedaEnNegocio: utilidadNeta - retiro,
    detalleGastos,
    comprasDelMes,
    variacionInventario: comprasDelMes - costoVenta,
  };
}

export const ETIQUETA_GASTO: Record<string, string> = {
  MANTENIMIENTO: "Mantenimiento",
  PUBLICIDAD: "Publicidad",
  TRANSPORTE: "Transporte",
  IMPUESTOS: "Impuestos",
  EQUIPOS: "Equipos",
  DOMICILIOS: "Domicilios",
  OTRO: "Otros",
};

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
