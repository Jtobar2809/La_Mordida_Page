"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { buildWhatsappOrderMessage, buildWhatsappLink } from "@/lib/whatsapp";
import { requiereDescuentoInventario, descontarInventarioPorOrden, revertirInventarioPorOrden } from "@/lib/inventario";
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
      pointsEarned: 0,
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

  // Precios reales desde la base de datos: nunca confiar en lo que mande el cliente.
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    include: { extras: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  const orderItemsData: {
    productId: string;
    quantity: number;
    unitPrice: number;
    notes: string | undefined;
    extras: { id: string; name: string; price: number }[];
  }[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) return { success: false, error: "Uno de los productos seleccionados ya no existe." };

    const selectedExtras = product.extras.filter((e) => item.extraIds.includes(e.id));
    const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0);
    subtotal += (product.price + extrasTotal) * item.quantity;

    orderItemsData.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.price,
      notes: item.notes,
      extras: selectedExtras.map((e) => ({ id: e.id, name: e.name, price: e.price })),
    });
  }

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
      items: { create: orderItemsData },
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

  await prisma.order.update({
    where: { id: orderId },
    data: { status: parsed.data },
  });

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
