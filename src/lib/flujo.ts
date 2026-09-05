import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ESTADOS_VENTA_CONFIRMADA } from "@/lib/inventario";
import { vigentesEn, repartirFijos } from "@/lib/costos-fijos";
import { SUMA_VENTA, desglosarVenta } from "@/lib/ventas";
import type { EstadoResultados } from "@/lib/contabilidad";

/**
 * El flujo del mes: una sola bolsa de plata.
 *
 * `contabilidad.ts` responde "¿el negocio es rentable?" y para eso tiene que
 * separar lo comprado de lo consumido: el bulto de papas que sigue en la
 * despensa no es costo del mes. Ese archivo tiene razón y no se toca.
 *
 * Pero esa no es la única pregunta, y no es la que uno se hace a fin de mes con
 * la calculadora en la mano. Esa es: **entró tanto, salió tanto, quedó tanto**
 * — y ahí la compra sí es plata que salió, exactamente igual que el arriendo,
 * sin importar dónde haya quedado guardada.
 *
 * Este archivo responde ESA. Una entrada es plata que llegó, una salida es
 * plata que se fue, y las compras son salidas como cualquier otra.
 *
 * Los dos números conviven a propósito y `construirPuente` explica por qué no
 * coinciden: la diferencia es, casi toda, la despensa. Tenerlos separados es lo
 * que permite que ninguno de los dos mienta — el mes que se llene la nevera el
 * flujo va a dar negativo, y eso es lo correcto: la plata efectivamente salió.
 */

const estadosConfirmados = ESTADOS_VENTA_CONFIRMADA as OrderStatus[];

export type LineaFlujo = {
  etiqueta: string;
  /** Siempre positivo. De qué lado está lo dice en cuál lista vive. */
  monto: number;
  nota?: string;
};

/** Los números crudos del mes, antes de armarlos en líneas. */
export type CifrasFlujo = {
  /** TODO lo cobrado en pedidos confirmados: comida, domicilio e impuesto. */
  ventasCobradas: number;
  /** Plata que entró al cajón por fuera de una venta. */
  otrosIngresos: number;

  /** Lo que se le pagó a proveedores. Salió del bolsillo el día que salió. */
  compras: number;
  /** Arriendo, servicios, mano de obra: el compromiso mensual vigente. */
  fijos: number;
  /** Gastos sueltos anotados en contabilidad. */
  gastos: number;
  /** Lo que los socios sacaron para ellos. */
  retiros: number;
  /**
   * Egresos de caja que no son compra, ni gasto, ni devolución de una venta
   * anulada: un traslado a la caja fuerte, por ejemplo. Se muestran porque
   * salieron del cajón, aunque algunos no salgan del negocio.
   */
  otrasSalidas: number;
};

export type FlujoDelMes = CifrasFlujo & {
  anio: number;
  mes: number;
  esMesEnCurso: boolean;
  entradas: LineaFlujo[];
  salidas: LineaFlujo[];
  totalEntradas: number;
  totalSalidas: number;
  /** totalEntradas − totalSalidas. Negativo = salió más de lo que entró. */
  neto: number;
};

/**
 * De cifras a las dos columnas del panel.
 *
 * Pura para poder probarla contra la mano: acá vive la regla de qué cuenta como
 * entrada y qué como salida, que es todo el aporte de este archivo.
 *
 * Las líneas en cero se caen. Un renglón de $0 no informa nada y obliga al ojo
 * a descartarlo antes de leer los que sí importan.
 */
export function construirFlujo(cifras: CifrasFlujo): {
  entradas: LineaFlujo[];
  salidas: LineaFlujo[];
  totalEntradas: number;
  totalSalidas: number;
  neto: number;
} {
  const entradas: LineaFlujo[] = [
    {
      etiqueta: "Ventas cobradas",
      monto: cifras.ventasCobradas,
      nota: "Todo lo que pagó el cliente, domicilio e impuesto incluidos: entró al cajón igual.",
    },
    {
      etiqueta: "Otros ingresos",
      monto: cifras.otrosIngresos,
      nota: "Plata que entró al cajón sin ser una venta.",
    },
  ].filter((l) => l.monto > 0);

  const salidas: LineaFlujo[] = [
    {
      etiqueta: "Compras a proveedores",
      monto: cifras.compras,
      nota: "Salió el día que se pagó, así el bulto siga en la despensa.",
    },
    {
      etiqueta: "Costos fijos",
      monto: cifras.fijos,
      nota: "El compromiso del mes: arriendo, servicios, mano de obra.",
    },
    { etiqueta: "Gastos del mes", monto: cifras.gastos },
    {
      etiqueta: "Retiros de socios",
      monto: cifras.retiros,
      nota: "No es un gasto del negocio, pero es plata que salió.",
    },
    {
      etiqueta: "Otras salidas de caja",
      monto: cifras.otrasSalidas,
      nota: "Egresos sin compra ni gasto detrás, como un traslado a la caja fuerte.",
    },
  ].filter((l) => l.monto > 0);

  const sumar = (lineas: LineaFlujo[]) => lineas.reduce((s, l) => s + l.monto, 0);
  const totalEntradas = sumar(entradas);
  const totalSalidas = sumar(salidas);

  return { entradas, salidas, totalEntradas, totalSalidas, neto: totalEntradas - totalSalidas };
}

export async function obtenerFlujoDelMes(anio: number, mes: number): Promise<FlujoDelMes> {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);
  const ahora = new Date();
  const rango = { gte: desde, lt: hasta };

  const [ventasAgg, ingresos, retiros, otrosEgresos, compras, gastos, costosFijos] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: estadosConfirmados }, createdAt: rango },
      _sum: SUMA_VENTA,
    }),

    prisma.movimientoCaja.aggregate({ where: { tipo: "INGRESO", createdAt: rango }, _sum: { monto: true } }),

    prisma.movimientoCaja.aggregate({ where: { tipo: "RETIRO", createdAt: rango }, _sum: { monto: true } }),

    // Los egresos que no está contando ya otra fila. Los tres `null` son lo que
    // evita cobrar la misma plata dos veces:
    //  - con `gastoId` lo cuenta la fila de gastos,
    //  - con `compraId` lo cuenta la de compras,
    //  - con `orderId` es la devolución de una venta anulada, y esa venta
    //    tampoco entró arriba (los estados confirmados la excluyen). Restarla
    //    dejaría el mes corto por el valor de cada pedido anulado.
    prisma.movimientoCaja.aggregate({
      where: { tipo: "EGRESO", createdAt: rango, gastoId: null, compraId: null, orderId: null },
      _sum: { monto: true },
    }),

    prisma.compra.aggregate({ where: { fecha: rango }, _sum: { total: true } }),

    prisma.gasto.aggregate({ where: { fecha: rango }, _sum: { monto: true } }),

    // Por vigencia, igual que el estado de resultados: un mes cerrado tiene que
    // seguir mostrando el arriendo que regía ESE mes.
    prisma.costoFijo.findMany({
      where: vigentesEn(desde, hasta),
      select: { monto: true, esRetiro: true },
    }),
  ]);

  // Acá sí entra todo lo cobrado, a diferencia del estado de resultados: el
  // domicilio y el impuesto no son utilidad, pero son billetes que entraron al
  // cajón, y esta pantalla cuenta billetes.
  const { ventas, domicilios, impuestos } = desglosarVenta(ventasAgg);

  // Del reparto solo sirve la mitad: el retiro PRESUPUESTADO no se suma acá,
  // porque una meta no es plata que salió. Lo retirado de verdad son los
  // movimientos de caja, y esos ya vienen por su lado.
  const { gastosFijos } = repartirFijos(costosFijos);

  const cifras: CifrasFlujo = {
    ventasCobradas: ventas + domicilios + impuestos,
    otrosIngresos: ingresos._sum?.monto ?? 0,
    compras: compras._sum?.total ?? 0,
    fijos: gastosFijos,
    gastos: gastos._sum?.monto ?? 0,
    retiros: retiros._sum?.monto ?? 0,
    otrasSalidas: otrosEgresos._sum?.monto ?? 0,
  };

  return {
    anio,
    mes,
    esMesEnCurso: ahora >= desde && ahora < hasta,
    ...cifras,
    ...construirFlujo(cifras),
  };
}

export type LineaPuente = {
  etiqueta: string;
  /** Firmado: así el signo se imprime sin volver a deducirlo. */
  monto: number;
  detalle: string;
};

/**
 * Cómo se llega de la utilidad a la plata que quedó.
 *
 * Sin esto, el panel de arriba y el de abajo dan dos cifras distintas y el
 * dueño se queda sin saber cuál creer. Con esto son la misma cifra vista de dos
 * maneras, y cada renglón nombra exactamente qué las separa.
 *
 * La identidad, despejada:
 *
 *   neto = (utilidad neta − retiro real)
 *          + domicilios + impuestos          ← entró, pero no es utilidad
 *          + otros ingresos − otras salidas
 *          − variación de inventario         ← se quedó en la despensa
 *          + ajustes de conteo
 *
 * Si esa suma no da `neto`, el puente miente y hay que arreglarlo acá, no
 * maquillar la diferencia en la pantalla. Por eso el test la verifica contra
 * `construirFlujo` en vez de contra números escritos a mano.
 */
export function construirPuente(flujo: FlujoDelMes, estado: EstadoResultados): LineaPuente[] {
  const lineas: LineaPuente[] = [
    {
      etiqueta: "Cobrado que no es venta tuya",
      monto: estado.domicilios + estado.impuestos,
      detalle: "Domicilios e impuesto: entraron al cajón, pero no son utilidad del negocio.",
    },
    {
      etiqueta: "Otros ingresos de caja",
      monto: flujo.otrosIngresos,
      detalle: "Plata que entró sin ser venta.",
    },
    {
      etiqueta: "Otras salidas de caja",
      monto: -flujo.otrasSalidas,
      detalle: "Egresos sin compra ni gasto detrás, como un traslado a la caja fuerte.",
    },
    {
      etiqueta: "Se quedó en la despensa",
      monto: -estado.variacionInventario,
      detalle:
        estado.variacionInventario >= 0
          ? "Compraste más de lo que consumiste: la plata salió, pero el inventario está ahí."
          : "Consumiste despensa que ya tenías: costo del mes que no costó plata este mes.",
    },
    {
      etiqueta: "Ajustes de conteo",
      monto: estado.ajustesPositivos,
      detalle: "Un conteo encontró más de lo que decía el sistema.",
    },
  ];

  return lineas.filter((l) => l.monto !== 0);
}
