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

/**
 * Cliente de Prisma aceptado por estas funciones: o el global, o el cliente de
 * una transacción en curso. Es lo que le permite a la caja registrar la venta,
 * el pago y el descuento de inventario en una sola transacción atómica — antes
 * el descuento abría su propia transacción y una venta podía quedar cobrada
 * pero sin descontar si algo fallaba en el medio.
 */
type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Cuánto insumo consume un pedido, sumando tres fuentes:
 *
 *  1. La receta (BOM) de cada producto × la cantidad vendida.
 *  2. Las recetas de los productos que componen un combo, si el producto es
 *     un combo (ver ComboItem).
 *  3. Los extras elegidos en cada línea, vía `ProductExtra.insumoId`.
 *
 * Los extras se ignoraban por completo hasta hace poco: se cobraban $3.000 de
 * "extra queso" y el queso nunca salía del inventario, así que el stock
 * teórico quedaba siempre por encima del real sin causa aparente. Los combos
 * tenían el mismo agujero pero peor: un combo no tiene receta propia, así que
 * vender uno de $38.000 no descontaba absolutamente nada.
 */
async function calcularConsumoDelPedido(db: DbClient, orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              recetaItems: true,
              // Un solo nivel de anidamiento porque un combo no puede contener
              // otro combo — la regla la impone upsertComboItem.
              comboItems: { include: { producto: { include: { recetaItems: true } } } },
            },
          },
        },
      },
    },
  });

  if (!order) return null;

  const consumo = new Map<string, number>(); // insumoId -> cantidad total
  const sumar = (insumoId: string, cantidad: number) =>
    consumo.set(insumoId, (consumo.get(insumoId) ?? 0) + cantidad);

  for (const item of order.items) {
    // La receta propia del producto. En un combo es opcional y suele ser solo
    // el empaque que lleva únicamente el combo.
    for (const recetaItem of item.product.recetaItems) {
      sumar(recetaItem.insumoId, recetaItem.cantidad * item.quantity);
    }

    // Y lo que traen adentro sus componentes. Igual que con los productos
    // sueltos, un componente sin receta simplemente no descuenta nada en vez
    // de frenar la venta.
    for (const comboItem of item.product.comboItems) {
      for (const recetaItem of comboItem.producto.recetaItems) {
        sumar(recetaItem.insumoId, recetaItem.cantidad * comboItem.cantidad * item.quantity);
      }
    }
  }

  // Los extras se guardan en OrderItem.extras como JSON congelado al momento
  // de la venta (para que el ticket histórico no cambie si luego se edita el
  // extra), así que de ahí solo sacamos los IDs y releemos la receta actual.
  const extraIds = [
    ...new Set(order.items.flatMap((item) => (Array.isArray(item.extras) ? item.extras : []).map(idDeExtra).filter(Boolean) as string[])),
  ];

  if (extraIds.length > 0) {
    const extras = await db.productExtra.findMany({
      where: { id: { in: extraIds }, insumoId: { not: null } },
      select: { id: true, insumoId: true, cantidadInsumo: true },
    });
    const recetaPorExtra = new Map(extras.map((e) => [e.id, e]));

    for (const item of order.items) {
      const seleccionados = Array.isArray(item.extras) ? item.extras : [];
      for (const raw of seleccionados) {
        const receta = recetaPorExtra.get(idDeExtra(raw) ?? "");
        if (!receta?.insumoId || !receta.cantidadInsumo) continue;
        sumar(receta.insumoId, receta.cantidadInsumo * item.quantity);
      }
    }
  }

  return { order, consumo };
}

/** Lee el `id` de un extra guardado como JSON, tolerando filas viejas o malformadas. */
function idDeExtra(raw: unknown): string | null {
  if (raw && typeof raw === "object" && "id" in raw) {
    const id = (raw as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
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
export async function descontarInventarioPorOrden(orderId: string, tx?: Prisma.TransactionClient) {
  if (tx) return aplicarDescuento(tx, orderId);
  return prisma.$transaction((t) => aplicarDescuento(t, orderId));
}

async function aplicarDescuento(db: DbClient, orderId: string) {
  const data = await calcularConsumoDelPedido(db, orderId);
  if (!data || data.order.inventarioDescontado) return;
  const { order, consumo } = data;

  const insumosInfo = await db.insumo.findMany({ where: { id: { in: [...consumo.keys()] } } });
  const costoPorInsumo = new Map(insumosInfo.map((i) => [i.id, i.costoUnitario]));

  for (const [insumoId, cantidad] of consumo) {
    await db.insumo.update({ where: { id: insumoId }, data: { stockActual: { decrement: cantidad } } });
    await db.movimientoInsumo.create({
      data: {
        insumoId,
        tipo: "SALIDA",
        cantidad,
        costoUnitario: costoPorInsumo.get(insumoId) ?? null,
        motivo: `Venta automática — pedido ${order.id}`,
        orderId: order.id,
        // Se fecha con el PEDIDO, no con el reloj. Un pedido web hecho el 31 y
        // confirmado el 1 dejaba la venta en un mes y su costo en el otro:
        // enero cerraba con una utilidad que no era suya y febrero con un costo
        // sin venta detrás. El costo tiene que caer donde cayó el ingreso.
        createdAt: order.createdAt,
      },
    });
  }

  await db.order.update({ where: { id: orderId }, data: { inventarioDescontado: true } });
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
export async function revertirInventarioPorOrden(orderId: string, tx?: Prisma.TransactionClient) {
  if (tx) return aplicarReversion(tx, orderId);
  return prisma.$transaction((t) => aplicarReversion(t, orderId));
}

async function aplicarReversion(db: DbClient, orderId: string) {
  const data = await calcularConsumoDelPedido(db, orderId);
  if (!data || !data.order.inventarioDescontado) return;
  const { order, consumo } = data;

  // Al costo de la SALIDA original, no al de hoy. Si el insumo subió de precio
  // entre la venta y la anulación, valorizar la devolución al precio nuevo
  // dejaba un residuo en el costo de venta: la entrada no cancelaba la salida
  // que venía a deshacer, y el mes quedaba con una diferencia sin causa.
  const salidas = await db.movimientoInsumo.findMany({
    where: { orderId, tipo: "SALIDA" },
    select: { insumoId: true, costoUnitario: true },
  });
  const costoOriginal = new Map(salidas.map((m) => [m.insumoId, m.costoUnitario]));

  // Solo para lo que no tenga salida registrada (recetas cambiadas después de
  // la venta): ahí lo mejor que se puede saber es el costo actual.
  const insumosInfo = await db.insumo.findMany({ where: { id: { in: [...consumo.keys()] } } });
  const costoActual = new Map(insumosInfo.map((i) => [i.id, i.costoUnitario]));

  for (const [insumoId, cantidad] of consumo) {
    await db.insumo.update({ where: { id: insumoId }, data: { stockActual: { increment: cantidad } } });
    await db.movimientoInsumo.create({
      data: {
        insumoId,
        tipo: "ENTRADA",
        cantidad,
        costoUnitario: costoOriginal.get(insumoId) ?? costoActual.get(insumoId) ?? null,
        motivo: `Reversión automática — pedido ${order.id} cancelado`,
        orderId: order.id,
        // Misma fecha que la salida que deshace, para que las dos caigan en el
        // mismo mes y se cancelen donde nacieron.
        createdAt: order.createdAt,
      },
    });
  }

  await db.order.update({ where: { id: orderId }, data: { inventarioDescontado: false } });
}

/**
 * Pérdidas = mermas explícitas + ajustes negativos (un ajuste negativo casi
 * siempre significa: se contó físicamente el insumo y había menos de lo que
 * el sistema esperaba). Compartido entre el reporte de Mermas y el Dashboard
 * para que ambos siempre muestren el mismo número.
 */
export async function obtenerPerdidas(desde?: Date, hasta?: Date) {
  // El rango se cierra en el WHERE, no recortando después. Antes esta consulta
  // pedía "todo desde el 1 de enero" ordenado de lo más nuevo a lo más viejo y
  // se quedaba con 300 filas: consultar enero devolvía las 300 mermas más
  // RECIENTES —las de agosto— y el mes de enero cerraba con $0 de mermas.
  const rango =
    desde || hasta ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lt: hasta } : {}) } } : {};

  const movimientos = await prisma.movimientoInsumo.findMany({
    where: {
      OR: [{ tipo: "MERMA" }, { tipo: "AJUSTE", cantidad: { lt: 0 } }],
      ...rango,
    },
    include: { insumo: { select: { nombre: true, unidad: true, costoUnitario: true } } },
    orderBy: { createdAt: "desc" },
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

  // `total` y `topInsumos` se calculan sobre TODO el rango; la tabla solo
  // pinta las últimas 300, que es lo que un humano llega a mirar. Antes el
  // recorte estaba en la consulta y por eso se comía los totales.
  return { movimientos, recientes: movimientos.slice(0, 300), total, topInsumos, costoDe };
}
