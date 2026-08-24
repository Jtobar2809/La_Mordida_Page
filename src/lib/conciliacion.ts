import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ESTADOS_VENTA_CONFIRMADA } from "@/lib/inventario";
import { clasificarConsumo } from "@/lib/costos";
import { SUMA_VENTA, desglosarVenta } from "@/lib/ventas";

/**
 * Conciliación: comparar fuentes que deberían decir lo mismo y señalar dónde no.
 *
 * Tres preguntas distintas, cada una con su comparación honesta:
 *
 *  1. ¿La plata contada en cada turno coincidió con la que el sistema esperaba?
 *  2. ¿Toda venta de mostrador dejó su rastro de pago en la caja?
 *  3. ¿Lo que se compró se parece a lo que se consumió, por insumo?
 *
 * Lo que NO se hace: comparar las ventas web contra la caja. Un domicilio se
 * paga en la puerta y nunca pasa por el cajón, así que meterlo en esa
 * comparación produciría un faltante fantasma en cada turno.
 */

const estadosConfirmados = ESTADOS_VENTA_CONFIRMADA as OrderStatus[];

export type TurnoConciliado = {
  id: string;
  codigo: string;
  cerradaAt: Date | null;
  esperadoEfectivo: number;
  efectivoContado: number;
  diferencia: number;
};

export type VentaSinRastro = {
  id: string;
  total: number;
  createdAt: Date;
  metodoPago: string | null;
};

export type InsumoConciliado = {
  nombre: string;
  unidad: string;
  comprado: number;
  /** Lo que salió de una tanda de cocina. Un elaborado no se compra, se prepara. */
  producido: number;
  /** TODO lo que salió: ventas, desechables, tandas de cocina y mermas. */
  consumido: number;
  /** comprado + producido − consumido: lo que debería haber quedado en la nevera. */
  diferencia: number;
  valorDiferencia: number;
};

export type Conciliacion = {
  // ── Caja ──
  turnos: TurnoConciliado[];
  turnosDescuadrados: TurnoConciliado[];
  totalSobrante: number;
  totalFaltante: number;
  hayTurnoAbierto: boolean;

  // ── Ventas vs caja ──
  ventasMostrador: number;
  ventasMostradorCantidad: number;
  cobradoEnCaja: number;
  diferenciaVentas: number;
  ventasSinRastro: VentaSinRastro[];
  ventasWeb: number;

  // ── Compras vs consumo ──
  insumos: InsumoConciliado[];
  totalComprado: number;
  totalConsumido: number;
};

export async function obtenerConciliacion(anio: number, mes: number): Promise<Conciliacion> {
  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);
  const rango = { gte: desde, lt: hasta };

  const [sesiones, ordenesMostrador, movimientosCaja, compraItems, movimientosInsumo, ordenesWeb] = await Promise.all([
    prisma.cajaSesion.findMany({
      where: { abiertaAt: rango },
      select: { id: true, codigo: true, estado: true, cerradaAt: true, esperadoEfectivo: true, efectivoContado: true, diferencia: true },
      orderBy: { abiertaAt: "desc" },
    }),

    prisma.order.findMany({
      where: { canal: "CAJA", status: { in: estadosConfirmados }, createdAt: rango },
      select: { id: true, total: true, createdAt: true, metodoPago: true },
      orderBy: { createdAt: "desc" },
    }),

    // Se trae el estado del pedido porque anular una venta en caja NO borra su
    // movimiento: deja el VENTA original y le suma un EGRESO que lo compensa.
    // Sumando los VENTA a secas, una venta anulada y vuelta a cobrar por otro
    // método se contaba dos veces y aparecía como un descuadre que no existe.
    prisma.movimientoCaja.findMany({
      where: { tipo: "VENTA", createdAt: rango },
      select: { monto: true, orderId: true, order: { select: { status: true } } },
    }),

    prisma.compraItem.findMany({
      where: { compra: { fecha: rango } },
      select: { cantidad: true, costoUnitario: true, insumo: { select: { id: true, nombre: true, unidad: true } } },
    }),

    // TODOS los movimientos, no solo los que cuelgan de un pedido. Con el filtro
    // viejo esta tabla mentía de dos formas a la vez: la mayonesa que se va a
    // un aderezo se consume sin pedido, así que salía con "consumido 0" y un
    // sobrante fantasma permanente; y el aderezo, que no se compra nunca,
    // salía con un déficit igual de permanente. Los desechables, lo mismo.
    prisma.movimientoInsumo.findMany({
      where: { createdAt: rango },
      select: {
        cantidad: true,
        tipo: true,
        costoUnitario: true,
        orderId: true,
        produccionId: true,
        insumo: { select: { id: true, nombre: true, unidad: true, costoUnitario: true } },
      },
    }),

    prisma.order.aggregate({
      where: { canal: "WEB", status: { in: estadosConfirmados }, createdAt: rango },
      _sum: SUMA_VENTA,
    }),
  ]);

  // ── 1. Arqueo de cada turno ──────────────────────────────────────────────
  const turnos: TurnoConciliado[] = sesiones
    .filter((s) => s.estado === "CERRADA" && s.diferencia !== null)
    .map((s) => ({
      id: s.id,
      codigo: s.codigo,
      cerradaAt: s.cerradaAt,
      esperadoEfectivo: s.esperadoEfectivo ?? 0,
      efectivoContado: s.efectivoContado ?? 0,
      diferencia: s.diferencia ?? 0,
    }));

  const turnosDescuadrados = turnos.filter((t) => t.diferencia !== 0);
  const totalSobrante = turnosDescuadrados.filter((t) => t.diferencia > 0).reduce((s, t) => s + t.diferencia, 0);
  const totalFaltante = turnosDescuadrados.filter((t) => t.diferencia < 0).reduce((s, t) => s + Math.abs(t.diferencia), 0);

  // ── 2. Ventas de mostrador vs lo cobrado en caja ─────────────────────────
  const ventasMostrador = ordenesMostrador.reduce((s, o) => s + o.total, 0);
  // Solo los cobros de pedidos que siguen en pie. Un movimiento sin pedido
  // asociado se cuenta igual: es plata que entró y alguien tiene que explicarla.
  const cobrosVigentes = movimientosCaja.filter((m) => !m.order || m.order.status !== "CANCELADO");
  const cobradoEnCaja = cobrosVigentes.reduce((s, m) => s + m.monto, 0);

  // Un pedido de mostrador sin movimiento de caja es una venta que nadie cobró
  // —o que se cobró por fuera del sistema—; vale la pena señalarlo uno por uno.
  const conRastro = new Set(cobrosVigentes.map((m) => m.orderId).filter(Boolean) as string[]);
  const ventasSinRastro: VentaSinRastro[] = ordenesMostrador
    .filter((o) => !conRastro.has(o.id))
    .map((o) => ({ id: o.id, total: o.total, createdAt: o.createdAt, metodoPago: o.metodoPago }));

  // ── 3. Comprado vs consumido, por insumo ─────────────────────────────────
  const porInsumo = new Map<string, InsumoConciliado & { costo: number }>();

  const asegurar = (id: string, nombre: string, unidad: string, costo: number) => {
    if (!porInsumo.has(id)) {
      porInsumo.set(id, {
        nombre,
        unidad,
        comprado: 0,
        producido: 0,
        consumido: 0,
        diferencia: 0,
        valorDiferencia: 0,
        costo,
      });
    }
    return porInsumo.get(id)!;
  };

  for (const ci of compraItems) {
    const fila = asegurar(ci.insumo.id, ci.insumo.nombre, ci.insumo.unidad, ci.costoUnitario);
    fila.comprado += ci.cantidad;
  }

  for (const m of movimientosInsumo) {
    const fila = asegurar(m.insumo.id, m.insumo.nombre, m.insumo.unidad, m.costoUnitario ?? m.insumo.costoUnitario);

    if (m.tipo === "PRODUCCION") {
      // Un elaborado no se compra: sale de una tanda. Sin esta columna, el
      // aderezo aparecía consumiéndose de la nada.
      fila.producido += m.cantidad;
    } else if (m.tipo === "SALIDA") {
      // Con pedido, sin pedido o hacia una tanda de cocina: en los tres casos
      // el insumo se fue del estante, que es lo que esta tabla mide.
      fila.consumido += m.cantidad;
    } else if (m.tipo === "ENTRADA") {
      // Con pedido es la reversión de una anulación: devuelve lo consumido.
      // Sin pedido es una compra, y las compras ya vienen de CompraItem —
      // sumarla aquí la contaría dos veces.
      if (m.orderId) fila.consumido -= m.cantidad;
    } else if (m.tipo === "MERMA") {
      fila.consumido += Math.abs(m.cantidad);
    } else if (m.tipo === "AJUSTE") {
      // Un ajuste negativo es faltante que apareció al contar: se fue igual.
      // Uno positivo es lo contrario, había de más.
      fila.consumido += -m.cantidad;
    }
  }

  const insumos: InsumoConciliado[] = [...porInsumo.values()]
    .map((f) => {
      const diferencia = f.comprado + f.producido - f.consumido;
      return {
        nombre: f.nombre,
        unidad: f.unidad,
        comprado: f.comprado,
        producido: f.producido,
        consumido: f.consumido,
        diferencia,
        valorDiferencia: diferencia * f.costo,
      };
    })
    .filter((f) => f.comprado !== 0 || f.producido !== 0 || f.consumido !== 0)
    .sort((a, b) => Math.abs(b.valorDiferencia) - Math.abs(a.valorDiferencia));

  return {
    turnos,
    turnosDescuadrados,
    totalSobrante,
    totalFaltante,
    hayTurnoAbierto: sesiones.some((s) => s.estado === "ABIERTA"),

    ventasMostrador,
    ventasMostradorCantidad: ordenesMostrador.length,
    cobradoEnCaja,
    diferenciaVentas: ventasMostrador - cobradoEnCaja,
    ventasSinRastro,
    ventasWeb: desglosarVenta(ordenesWeb).ventas,

    insumos,
    totalComprado: compraItems.reduce((s, ci) => s + ci.cantidad * ci.costoUnitario, 0),
    // En valor sí se descartan las tandas de cocina: preparar un aderezo mueve
    // plata de unos insumos a otro, no la gasta. En cantidades la tabla de
    // arriba sí las muestra, porque ahí la pregunta es otra —qué salió del
    // estante— y son dos preguntas distintas a propósito.
    totalConsumido: clasificarConsumo(movimientosInsumo).salidaNeta,
  };
}
