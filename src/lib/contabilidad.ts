import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ESTADOS_VENTA_CONFIRMADA } from "@/lib/inventario";
import { clasificarConsumo } from "@/lib/costos";
import { vigentesEn, repartirFijos } from "@/lib/costos-fijos";
import { SUMA_VENTA, desglosarVenta } from "@/lib/ventas";

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

  /** Comida vendida, neta de descuentos. NO incluye domicilio ni impuesto. */
  ventas: number;
  pedidos: number;
  /** Cobrado por domicilios. Entra y vuelve a salir; no es venta del negocio. */
  domicilios: number;
  /** Impuesto recaudado. Es plata de la DIAN que uno solo está guardando. */
  impuestos: number;

  /** Insumos de receta que se fueron en las ventas del mes. */
  costoVenta: number;
  /**
   * Bolsas, papel y desechables: se descuentan a mano, sin pedido detrás, y
   * hasta hace poco no aparecían en ningún renglón. Son costo variable de
   * vender igual que la carne, así que van ARRIBA de la utilidad bruta.
   */
  consumoOperacion: number;
  utilidadBruta: number;
  margenBrutoPct: number;

  gastosFijos: number;
  gastosDelMes: number;
  mermas: number;
  totalGastos: number;

  utilidadNeta: number;
  margenNetoPct: number;

  /**
   * Lo que los socios PLANEAN sacar al mes (los costos fijos marcados como
   * retiro). Es la meta con la que se calcula el punto de equilibrio: hay que
   * venderlo igual, se haya sacado o no.
   */
  retiroPresupuestado: number;
  /**
   * Lo que de verdad salió del cajón este mes, retiro por retiro. Es esto —y
   * no el presupuesto— lo que se resta para saber cuánta plata quedó adentro.
   *
   * Ambos van DEBAJO de la utilidad: repartir la ganancia no es un costo de
   * operar. Restarlos antes haría ver el negocio menos rentable de lo que es.
   */
  retiroReal: number;
  quedaEnNegocio: number;

  /** Desglose para el gráfico de a dónde se va la plata. */
  detalleGastos: LineaGasto[];

  /**
   * Plata que salió a proveedores este mes. NO es costo del período — parte
   * quedó en inventario. Se muestra aparte justamente para poder explicarlo.
   */
  comprasDelMes: number;
  /**
   * Cuánto de lo comprado no se consumió (o al revés, si se comió despensa).
   * Cuadra con el movimiento real del stock: compras menos TODO lo que salió
   * —ventas, desechables y mermas— más lo que un conteo encontró de más.
   */
  variacionInventario: number;
  /** Ajustes de conteo hacia arriba. Se expone para poder explicar el cuadre. */
  ajustesPositivos: number;
};

export async function obtenerEstadoResultados(anio: number, mes: number): Promise<EstadoResultados> {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);
  const ahora = new Date();
  const esMesEnCurso = ahora >= desde && ahora < hasta;

  const rango = { gte: desde, lt: hasta };

  const [ventasAgg, movimientos, costosFijos, gastos, compras, retiros] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: estadosConfirmados }, createdAt: rango },
      _sum: SUMA_VENTA,
      _count: { _all: true },
    }),

    // TODOS los movimientos del mes, no solo los que cuelgan de un pedido.
    // `clasificarConsumo` los separa: lo que se fue en ventas, lo que se fue en
    // desechables y lo que se perdió. Antes esta consulta filtraba
    // `orderId: { not: null }` y las bolsas —que se descuentan a mano, sin
    // pedido— desaparecían del estado de resultados: bajaban del stock, la
    // plata ya estaba pagada, y la utilidad no se enteraba.
    prisma.movimientoInsumo.findMany({
      where: { createdAt: rango },
      select: {
        tipo: true,
        cantidad: true,
        costoUnitario: true,
        orderId: true,
        produccionId: true,
        insumo: { select: { costoUnitario: true } },
      },
    }),

    // Por vigencia, NO por `activo`. Un mes cerrado tiene que seguir mostrando
    // el arriendo que se pagó ESE mes, aunque hoy sea otro o ya no exista.
    prisma.costoFijo.findMany({
      where: vigentesEn(desde, hasta),
      select: { nombre: true, monto: true, esRetiro: true },
    }),

    prisma.gasto.findMany({ where: { fecha: rango }, select: { categoria: true, monto: true } }),

    prisma.compra.aggregate({ where: { fecha: rango }, _sum: { total: true } }),

    // Los retiros salen de la caja, no de una tabla de gastos: son plata que
    // sale del cajón, y por eso viven como movimientos del turno.
    prisma.movimientoCaja.aggregate({ where: { tipo: "RETIRO", createdAt: rango }, _sum: { monto: true } }),
  ]);

  // `total` incluye domicilio e impuesto; ninguno de los dos es venta del
  // negocio. Ver lib/ventas.ts.
  const { ventas, domicilios, impuestos } = desglosarVenta(ventasAgg);
  const pedidos = ventasAgg._count._all;

  const consumo = clasificarConsumo(movimientos);
  const costoVenta = consumo.venta;
  const consumoOperacion = consumo.operacion;

  // Los desechables son costo de vender, igual que la carne: sin bolsa no sale
  // el pedido. Por eso restan ANTES de la utilidad bruta y no como un gasto
  // más abajo — si no, el margen de contribución sale inflado y con él el
  // punto de equilibrio (ver operacion.ts).
  const utilidadBruta = ventas - costoVenta - consumoOperacion;

  const { gastosFijos, retiroPresupuestado } = repartirFijos(costosFijos);
  const retiroReal = retiros._sum?.monto ?? 0;

  const gastosDelMes = gastos.reduce((s, g) => s + g.monto, 0);

  // Salen de la misma clasificación que el costo de venta, así que el mes que
  // se está mirando es exactamente el mismo para los dos y no hay forma de que
  // una merma se cuente en el mes equivocado.
  const mermas = consumo.perdidas;

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
    domicilios,
    impuestos,
    costoVenta,
    consumoOperacion,
    utilidadBruta,
    margenBrutoPct: ventas > 0 ? (utilidadBruta / ventas) * 100 : 0,
    gastosFijos,
    gastosDelMes,
    mermas,
    totalGastos,
    utilidadNeta,
    margenNetoPct: ventas > 0 ? (utilidadNeta / ventas) * 100 : 0,
    retiroPresupuestado,
    retiroReal,
    // Con lo REALMENTE retirado, no con el presupuesto: la plata que quedó
    // adentro es la que nadie sacó, y en un mes donde los socios sacaron menos
    // (o más) de lo planeado, restar la meta contaría una ficción.
    quedaEnNegocio: utilidadNeta - retiroReal,
    detalleGastos,
    comprasDelMes,
    // La identidad del inventario: lo que entró menos todo lo que salió. Antes
    // era `compras − costoVenta` a secas, así que los desechables gastados y
    // las mermas se contaban como si siguieran en la despensa.
    variacionInventario: comprasDelMes - consumo.salidaNeta,
    ajustesPositivos: consumo.ajustesPositivos,
  };
}

/**
 * Los tramos de la cascada "de la venta a la utilidad".
 *
 * `rango` es [desde, hasta]: cada barra flota entre esos dos valores, y por eso
 * puede cruzar el cero. Antes esto vivía dentro del componente apilando una
 * base transparente, y una base no sabe bajar de cero: una utilidad negativa se
 * dibujaba hacia arriba, con la misma forma que tendría una ganancia. Vive aquí
 * para poder probarlo sin montar React.
 */
export type TramoCascada = {
  nombre: string;
  /** Firmado: negativo es plata que sale. Es lo que se muestra como etiqueta. */
  monto: number;
  rol: "entra" | "sale" | "resultado";
  rango: [number, number];
};

export function construirCascada(d: {
  ventas: number;
  costoVenta: number;
  consumoOperacion: number;
  utilidadBruta: number;
  gastosFijos: number;
  gastosDelMes: number;
  mermas: number;
  utilidadNeta: number;
}): TramoCascada[] {
  const pasos: TramoCascada[] = [
    { nombre: "Ventas", monto: d.ventas, rol: "entra", rango: [0, d.ventas] },
  ];

  // Los dos costos variables bajan desde las ventas hasta la utilidad bruta,
  // uno detrás del otro. Se recorre en vez de escribirse a mano para que el
  // tramo de desechables no exista cuando vale cero.
  let sobreLaVenta = d.ventas;
  for (const [nombre, monto] of [
    ["Insumos", d.costoVenta],
    ["Desechables", d.consumoOperacion],
  ] as const) {
    if (monto <= 0) continue;
    const siguiente = sobreLaVenta - monto;
    pasos.push({ nombre, monto: -monto, rol: "sale", rango: [siguiente, sobreLaVenta] });
    sobreLaVenta = siguiente;
  }

  pasos.push({ nombre: "Utilidad bruta", monto: d.utilidadBruta, rol: "resultado", rango: [0, d.utilidadBruta] });

  let corriendo = d.utilidadBruta;
  for (const [nombre, monto] of [
    ["Fijos", d.gastosFijos],
    ["Gastos", d.gastosDelMes],
    ["Mermas", d.mermas],
  ] as const) {
    // Una línea en cero no aporta nada y mete una barra invisible en el eje.
    if (monto <= 0) continue;
    const siguiente = corriendo - monto;
    pasos.push({ nombre, monto: -monto, rol: "sale", rango: [siguiente, corriendo] });
    corriendo = siguiente;
  }

  pasos.push({ nombre: "Utilidad neta", monto: d.utilidadNeta, rol: "resultado", rango: [0, d.utilidadNeta] });
  return pasos;
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
