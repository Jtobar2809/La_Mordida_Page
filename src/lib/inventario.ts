import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Estados de pedido a partir de los cuales se considera que la venta es real
 * y por lo tanto debe descontar inventario. PENDIENTE se deja fuera a propósito:
 * un pedido de un cliente por WhatsApp puede no llegar a confirmarse nunca
 * (mensaje no enviado, cliente se arrepiente, etc.), y no queremos descontar
 * insumos por algo que nunca se preparó.
 */
const ESTADOS_QUE_DESCUENTAN = new Set(["CONFIRMADO", "EN_PREPARACION", "EN_CAMINO", "ENTREGADO"]);

export const ESTADOS_VENTA_CONFIRMADA = [...ESTADOS_QUE_DESCUENTAN];

export function requiereDescuentoInventario(status: string) {
  return ESTADOS_QUE_DESCUENTAN.has(status);
}

async function calcularConsumoDelPedido(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { include: { recetaItems: true } } } } },
  });

  if (!order) return null;

  const consumo = new Map<string, number>(); // insumoId -> cantidad total
  for (const item of order.items) {
    for (const recetaItem of item.product.recetaItems) {
      const cantidadTotal = recetaItem.cantidad * item.quantity;
      consumo.set(recetaItem.insumoId, (consumo.get(recetaItem.insumoId) ?? 0) + cantidadTotal);
    }
  }

  return { order, consumo };
}

/**
 * Descuenta del inventario los insumos de cada producto vendido en un pedido,
 * según su receta (BOM). Idempotente: si el pedido ya fue descontado
 * (inventarioDescontado === true) no hace nada.
 *
 * A propósito NO bloquea ni lanza error si un insumo queda en negativo: el
 * objetivo de esta fase es no frenar la operación del restaurante por un
 * desfase de inventario. El stock negativo queda visible como alerta en
 * /admin/inventario para que lo revises y corrijas.
 *
 * Productos sin receta definida (combos, bebidas, adicionales por ahora)
 * simplemente no descuentan nada — no es un error, es una limitación conocida
 * de esta fase.
 */
export async function descontarInventarioPorOrden(orderId: string) {
  const data = await calcularConsumoDelPedido(orderId);
  if (!data || data.order.inventarioDescontado) return;
  const { order, consumo } = data;

  const insumosInfo = await prisma.insumo.findMany({ where: { id: { in: [...consumo.keys()] } } });
  const costoPorInsumo = new Map(insumosInfo.map((i) => [i.id, i.costoUnitario]));

  const operaciones: Prisma.PrismaPromise<unknown>[] = [];
  for (const [insumoId, cantidad] of consumo) {
    operaciones.push(prisma.insumo.update({ where: { id: insumoId }, data: { stockActual: { decrement: cantidad } } }));
    operaciones.push(
      prisma.movimientoInsumo.create({
        data: {
          insumoId,
          tipo: "SALIDA",
          cantidad,
          costoUnitario: costoPorInsumo.get(insumoId) ?? null,
          motivo: `Venta automática — pedido ${order.id}`,
          orderId: order.id,
        },
      })
    );
  }
  operaciones.push(prisma.order.update({ where: { id: orderId }, data: { inventarioDescontado: true } }));

  await prisma.$transaction(operaciones);
}

/**
 * Revierte el descuento de inventario de un pedido cancelado, asumiendo que
 * los insumos no llegaron a consumirse (el caso más común: se cancela antes
 * de o durante la preparación).
 *
 * Si en tu caso el pedido se canceló DESPUÉS de preparar la comida (y por lo
 * tanto el insumo sí se perdió), no confíes en esta reversión: repórtalo
 * como MERMA manual desde /admin/inventario para que quede bien registrado
 * como pérdida y no como si nunca se hubiera usado.
 */
export async function revertirInventarioPorOrden(orderId: string) {
  const data = await calcularConsumoDelPedido(orderId);
  if (!data || !data.order.inventarioDescontado) return;
  const { order, consumo } = data;

  const insumosInfo = await prisma.insumo.findMany({ where: { id: { in: [...consumo.keys()] } } });
  const costoPorInsumo = new Map(insumosInfo.map((i) => [i.id, i.costoUnitario]));

  const operaciones: Prisma.PrismaPromise<unknown>[] = [];
  for (const [insumoId, cantidad] of consumo) {
    operaciones.push(prisma.insumo.update({ where: { id: insumoId }, data: { stockActual: { increment: cantidad } } }));
    operaciones.push(
      prisma.movimientoInsumo.create({
        data: {
          insumoId,
          tipo: "ENTRADA",
          cantidad,
          costoUnitario: costoPorInsumo.get(insumoId) ?? null,
          motivo: `Reversión automática — pedido ${order.id} cancelado`,
          orderId: order.id,
        },
      })
    );
  }
  operaciones.push(prisma.order.update({ where: { id: orderId }, data: { inventarioDescontado: false } }));

  if (operaciones.length > 0) await prisma.$transaction(operaciones);
}

/**
 * Pérdidas = mermas explícitas + ajustes negativos (un ajuste negativo casi
 * siempre significa: se contó físicamente el insumo y había menos de lo que
 * el sistema esperaba). Compartido entre el reporte de Mermas y el Dashboard
 * para que ambos siempre muestren el mismo número.
 */
export async function obtenerPerdidas(desde?: Date) {
  const movimientos = await prisma.movimientoInsumo.findMany({
    where: {
      OR: [{ tipo: "MERMA" }, { tipo: "AJUSTE", cantidad: { lt: 0 } }],
      ...(desde ? { createdAt: { gte: desde } } : {}),
    },
    include: { insumo: { select: { nombre: true, unidad: true, costoUnitario: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const costoDe = (m: (typeof movimientos)[number]) => Math.abs(m.cantidad) * (m.costoUnitario ?? m.insumo.costoUnitario);
  const total = movimientos.reduce((sum, m) => sum + costoDe(m), 0);

  const porInsumo = new Map<string, { nombre: string; costo: number }>();
  for (const m of movimientos) {
    const actual = porInsumo.get(m.insumoId) ?? { nombre: m.insumo.nombre, costo: 0 };
    actual.costo += costoDe(m);
    porInsumo.set(m.insumoId, actual);
  }
  const topInsumos = [...porInsumo.values()].sort((a, b) => b.costo - a.costo).slice(0, 5);

  return { movimientos, total, topInsumos, costoDe };
}
