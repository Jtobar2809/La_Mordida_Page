"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatCOP } from "@/lib/utils";
import { buildWhatsappOrderMessage, buildWhatsappLink } from "@/lib/whatsapp";
import { requiereDescuentoInventario, descontarInventarioPorOrden, revertirInventarioPorOrden } from "@/lib/inventario";
import { priceOrderItems } from "@/lib/pricing";
import type { ActionResult } from "@/actions/auth";

/**
 * Lo que manda el carrito del navegador. Solo `productId`, `quantity`,
 * `notes` y los IDs de extras son datos de verdad: `name`, `unitPrice` y
 * `extras[].price` viajan porque el carrito de localStorage los guarda para
 * pintar la UI, pero el servidor los IGNORA por completo y vuelve a leer
 * nombre y precio desde la base de datos (ver `priceOrderItems`).
 *
 * Es la misma regla que ya aplicaba `createManualOrder`: nunca confiar en un
 * precio que viene del cliente. Sin esto, editar `la-mordida-cart` en
 * localStorage permitía confirmar un pedido a $0 — y el mensaje que le llega
 * al restaurante por WhatsApp mostraba ese total manipulado como legítimo.
 */
const cartItemSchema = z.object({
  productId: z.string(),
  name: z.string().optional(),
  quantity: z.number().int().positive().max(50, "Cantidad máxima por producto: 50"),
  unitPrice: z.number().optional(),
  notes: z.string().max(300).optional(),
  extras: z
    .array(z.object({ id: z.string(), name: z.string().optional(), price: z.number().optional() }))
    .default([]),
});

const createOrderSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Tu carrito está vacío"),
  deliveryType: z.enum(["DOMICILIO", "RECOGE_EN_TIENDA"]),
  address: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  couponCode: z.string().max(40).optional(),
});

export async function createOrder(
  input: unknown
): Promise<ActionResult<{ orderId: string; whatsappUrl: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Debes iniciar sesión para hacer un pedido." };

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { items, deliveryType, address, notes, couponCode } = parsed.data;

  if (deliveryType === "DOMICILIO" && !address?.trim()) {
    return { success: false, error: "Ingresa una dirección de entrega." };
  }

  const settings = await getSettings();

  // Precios reales desde la base de datos: lo que mandó el navegador solo
  // sirve para saber QUÉ se pidió, nunca CUÁNTO cuesta.
  const pricing = await priceOrderItems(
    items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      extraIds: i.extras.map((e) => e.id),
      notes: i.notes,
    })),
    { requireAvailable: true }
  );
  if (!pricing.ok) return { success: false, error: pricing.error };

  const { items: pricedItems, subtotal, descuentoPromos } = pricing;

  // Un cupón que no aplica ya no se ignora en silencio: antes el pedido salía
  // igual a precio completo y el cliente creía haber usado su descuento.
  let discount = 0;
  let appliedCoupon: string | null = null;
  const normalizedCoupon = couponCode?.trim().toUpperCase();

  if (normalizedCoupon) {
    const coupon = await prisma.coupon.findUnique({ where: { code: normalizedCoupon } });

    if (!coupon || !coupon.active) {
      return { success: false, error: "Ese cupón no existe o ya no está activo." };
    }
    if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
      return { success: false, error: "Ese cupón ya venció." };
    }
    if (subtotal < coupon.minOrder) {
      return {
        success: false,
        error: `Este cupón aplica desde ${formatCOP(coupon.minOrder)} de compra. Te faltan ${formatCOP(coupon.minOrder - subtotal)}.`,
      };
    }

    // Reserva atómica del uso: la condición `used < usageLimit` la evalúa
    // Postgres en el WHERE de la propia escritura, así que dos pedidos
    // simultáneos por el último uso no pueden ganar los dos (antes sí:
    // ambos leían `used` antes de que cualquiera escribiera).
    const usageGuard = coupon.usageLimit === null ? {} : { used: { lt: coupon.usageLimit } };
    const claimed = await prisma.coupon.updateMany({
      where: { id: coupon.id, active: true, ...usageGuard },
      data: { used: { increment: 1 } },
    });
    if (claimed.count === 0) {
      return { success: false, error: "Este cupón ya alcanzó su límite de usos." };
    }

    discount =
      coupon.discountType === "PORCENTAJE" ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
    discount = Math.min(discount, subtotal);
    appliedCoupon = coupon.code;
  }

  // Las promociones automáticas (2x1, 3x2) se suman al descuento del cupón: son
  // dos rebajas distintas sobre el mismo pedido y ambas salen del subtotal.
  // Se topa contra el subtotal para que un cupón grande sobre un pedido ya
  // promocionado no pueda dejar un total negativo.
  discount = Math.min(discount + descuentoPromos, subtotal);

  const deliveryFee = deliveryType === "DOMICILIO" ? Number(settings.deliveryFee) : 0;
  const taxRate = Number(settings.taxRate) || 0;
  const tax = Math.floor(((subtotal - discount) * taxRate) / 100);
  const total = subtotal - discount + deliveryFee + tax;

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      deliveryType,
      address: deliveryType === "DOMICILIO" ? address : null,
      notes,
      subtotal,
      deliveryFee,
      tax,
      discount,
      total,
      couponCode: appliedCoupon,
      pointsEarned: 0,
      items: {
        create: pricedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
          extras: item.extras,
        })),
      },
    },
    include: { items: true, user: true },
  });

  const message = buildWhatsappOrderMessage({
    orderId: order.id,
    customerName: order.user.name ?? "Cliente",
    items: pricedItems.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      notes: i.notes,
      extras: i.extras,
    })),
    subtotal,
    deliveryFee,
    discount,
    total,
    deliveryType,
    address: address ?? undefined,
    notes,
  });

  const whatsappUrl = buildWhatsappLink(settings.whatsappNumber, message);

  await prisma.order.update({ where: { id: order.id }, data: { whatsappSent: true } });

  return { success: true, data: { orderId: order.id, whatsappUrl } };
}

const manualOrderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  extraIds: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const orderStatusSchema = z.enum([
  "PENDIENTE",
  "CONFIRMADO",
  "EN_PREPARACION",
  "EN_CAMINO",
  "ENTREGADO",
  "CANCELADO",
]);

const createManualOrderSchema = z.object({
  customerName: z.string().min(2, "El nombre es muy corto"),
  customerPhone: z.string().optional(),
  items: z.array(manualOrderItemSchema).min(1, "Agrega al menos un producto"),
  deliveryType: z.enum(["DOMICILIO", "RECOGE_EN_TIENDA"]),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: orderStatusSchema.default("ENTREGADO"),
});

/** Crea un pedido desde el admin, para clientes que compran en el sitio físico. */
export async function createManualOrder(input: unknown): Promise<ActionResult<{ orderId: string }>> {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return { success: false, error: "No autorizado" };

  const parsed = createManualOrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { customerName, customerPhone, items, deliveryType, address, notes, status } = parsed.data;

  if (deliveryType === "DOMICILIO" && !address?.trim()) {
    return { success: false, error: "Ingresa una dirección de entrega." };
  }

  // Reutiliza un cliente existente si el teléfono ya coincide con una cuenta
  // (por ejemplo un cliente recurrente que compra en el local); si no, crea
  // una cuenta liviana "de mostrador" con solo nombre y teléfono.
  const phone = customerPhone?.trim() || undefined;
  let customer = phone ? await prisma.user.findFirst({ where: { phone } }) : null;

  if (!customer) {
    customer = await prisma.user.create({
      data: { name: customerName, phone: phone ?? null, role: "CLIENTE" },
    });
  }

  // Precios reales desde la base de datos, con el mismo valorador que usa el
  // checkout público. `requireAvailable: false` porque una venta de mostrador
  // puede ser de algo que se acaba de marcar como agotado en la web.
  const pricing = await priceOrderItems(items, { requireAvailable: false });
  if (!pricing.ok) return { success: false, error: pricing.error };

  const { items: orderItemsData, subtotal } = pricing;

  const settings = await getSettings();
  const deliveryFee = deliveryType === "DOMICILIO" ? Number(settings.deliveryFee) : 0;
  const taxRate = Number(settings.taxRate) || 0;
  const tax = Math.floor((subtotal * taxRate) / 100);
  const total = subtotal + deliveryFee + tax;

  const order = await prisma.order.create({
    data: {
      userId: customer.id,
      status,
      deliveryType,
      address: deliveryType === "DOMICILIO" ? address : null,
      notes,
      subtotal,
      deliveryFee,
      tax,
      discount: 0,
      total,
      pointsEarned: 0,
      whatsappSent: false,
      items: {
        create: orderItemsData.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
          extras: item.extras,
        })),
      },
    },
  });

  // Si el pedido de mostrador ya nace "confirmado" o más adelante en el flujo
  // (por defecto ENTREGADO, venta física ya completada), descuenta insumos ya mismo.
  if (requiereDescuentoInventario(status)) {
    await descontarInventarioPorOrden(order.id);
  }

  return { success: true, data: { orderId: order.id } };
}

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return { success: false, error: "No autorizado" };

  const parsed = orderStatusSchema.safeParse(status);
  if (!parsed.success) return { success: false, error: "Estado inválido" };

  // Una venta de mostrador no tiene ciclo de vida: nace cobrada y entregada.
  // Cancelarla desde aquí devolvería los insumos al inventario pero dejaría la
  // plata registrada en el turno, y la caja cerraría con un sobrante fantasma.
  // Anularla desde /admin/caja hace las dos cosas a la vez.
  const orden = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      canal: true,
      cajaSesionId: true,
      movimientosCaja: { where: { tipo: "VENTA" }, select: { metodo: true, monto: true, sesionId: true } },
    },
  });
  if (!orden) return { success: false, error: "Ese pedido ya no existe." };
  if (orden.canal === "CAJA") {
    return { success: false, error: "Es una venta de caja. Anúlala desde /admin/caja para que también se devuelva el dinero del turno." };
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: parsed.data },
  });

  // Si el pedido web ya tenía el pago registrado, cancelarlo tiene que devolver
  // esa plata. Sin esto el cobro se quedaba adentro y el arqueo cerraba con un
  // sobrante fantasma: el cajón decía tener una plata que se le devolvió al
  // cliente. Es el mismo mecanismo que `anularVenta` para el mostrador — EGRESO
  // y no "venta negativa", porque devolverle al cliente es plata que sale.
  //
  // La devolución va al turno ABIERTO, no al turno donde entró el cobro. Si el
  // pedido se pagó anoche y se cancela hoy, la plata sale del cajón de hoy;
  // escribirla en el turno de anoche movería un arqueo que alguien ya contó y
  // firmó. Es la misma regla que `anularVenta` aplica al negarse a anular
  // ventas de turnos cerrados.
  if (parsed.data === "CANCELADO" && orden.movimientosCaja.length > 0) {
    const sesionAbierta = await prisma.cajaSesion.findFirst({
      where: { estado: "ABIERTA" },
      select: { id: true, codigo: true },
    });

    if (!sesionAbierta) {
      return {
        success: true,
        aviso:
          "El pedido quedó cancelado, pero no hay caja abierta para registrar la devolución. Cuando abras el turno, anota el egreso a mano o el saldo va a quedar alto por ese valor.",
      };
    }

    await prisma.movimientoCaja.createMany({
      data: orden.movimientosCaja.map((m) => ({
        sesionId: sesionAbierta.id,
        tipo: "EGRESO" as const,
        metodo: m.metodo,
        monto: m.monto,
        concepto: `Devolución pedido web ${orderId.slice(-6).toUpperCase()}`,
        orderId,
      })),
    });
    revalidatePath("/admin/caja");
    revalidatePath("/admin/contabilidad");
    return { success: true, aviso: `Se devolvió el pago como egreso del turno ${sesionAbierta.codigo}.` };
  }

  // Un pedido confirmado (o más adelante en el flujo) consume insumos según receta.
  // Si se cancela un pedido que ya había descontado stock, se asume que los
  // insumos no se llegaron a usar y se revierte automáticamente (ver el aviso
  // en src/lib/inventario.ts sobre el caso de comida ya preparada y perdida).
  if (parsed.data === "CANCELADO") {
    await revertirInventarioPorOrden(orderId);
  } else if (requiereDescuentoInventario(parsed.data)) {
    await descontarInventarioPorOrden(orderId);
  }

  return { success: true };
}
