"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { calculatePointsForAmount, awardPoints } from "@/lib/points";
import { updateChallengesForOrder } from "@/lib/challenges";
import { buildWhatsappOrderMessage, buildWhatsappLink } from "@/lib/whatsapp";
import { PointsType } from "@prisma/client";
import type { ActionResult } from "@/actions/auth";

const cartItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  notes: z.string().optional(),
  extras: z.array(z.object({ id: z.string(), name: z.string(), price: z.number() })).default([]),
});

const createOrderSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Tu carrito está vacío"),
  deliveryType: z.enum(["DOMICILIO", "RECOGE_EN_TIENDA"]),
  address: z.string().optional(),
  notes: z.string().optional(),
  couponCode: z.string().optional(),
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

  const subtotal = items.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    return sum + (item.unitPrice + extrasTotal) * item.quantity;
  }, 0);

  let discount = 0;
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    if (coupon && coupon.active && subtotal >= coupon.minOrder) {
      const notExpired = !coupon.expiresAt || coupon.expiresAt > new Date();
      const hasUses = !coupon.usageLimit || coupon.used < coupon.usageLimit;
      if (notExpired && hasUses) {
        discount = coupon.discountType === "PORCENTAJE" ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
        discount = Math.min(discount, subtotal);
        await prisma.coupon.update({ where: { id: coupon.id }, data: { used: { increment: 1 } } });
      }
    }
  }

  const deliveryFee = deliveryType === "DOMICILIO" ? Number(settings.deliveryFee) : 0;
  const taxRate = Number(settings.taxRate) || 0;
  const tax = Math.floor(((subtotal - discount) * taxRate) / 100);
  const total = subtotal - discount + deliveryFee + tax;

  const pointsToEarn = await calculatePointsForAmount(total, session.user.id);

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
      couponCode: discount > 0 ? couponCode?.toUpperCase() : null,
      pointsEarned: pointsToEarn,
      items: {
        create: items.map((item) => ({
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

  if (pointsToEarn > 0) {
    await awardPoints({
      userId: session.user.id,
      points: pointsToEarn,
      type: PointsType.GANADO_COMPRA,
      description: `Pedido #${order.id.slice(-6).toUpperCase()}`,
      orderId: order.id,
    });
  }

  await updateChallengesForOrder(session.user.id, order);

  const message = buildWhatsappOrderMessage({
    orderId: order.id,
    customerName: order.user.name ?? "Cliente",
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, notes: i.notes, extras: i.extras })),
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

const orderStatusSchema = z.enum([
  "PENDIENTE",
  "CONFIRMADO",
  "EN_PREPARACION",
  "EN_CAMINO",
  "ENTREGADO",
  "CANCELADO",
]);

export async function updateOrderStatus(orderId: string, status: string): Promise<ActionResult> {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return { success: false, error: "No autorizado" };

  const parsed = orderStatusSchema.safeParse(status);
  if (!parsed.success) return { success: false, error: "Estado inválido" };

  await prisma.order.update({
    where: { id: orderId },
    data: { status: parsed.data },
  });

  return { success: true };
}
