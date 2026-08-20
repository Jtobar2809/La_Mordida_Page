import { prisma } from "@/lib/prisma";
import { calcularDescuentoPromos, reglaVigente, type PromoAplicada } from "@/lib/promociones";

/**
 * Única fuente de verdad de precios para CUALQUIER venta: el checkout del
 * cliente, el pedido manual del admin y la caja del mostrador.
 *
 * Recibe SOLO identificadores y devuelve las líneas ya valoradas con datos
 * leídos de la base de datos. Nunca acepta un precio que venga del navegador:
 * sin esta regla, editar `la-mordida-cart` en localStorage permitía confirmar
 * un pedido a $0. La caja hereda la misma garantía gratis.
 *
 * `requireAvailable` distingue los usos: un cliente no puede pedir por la web
 * un producto marcado como agotado, pero en el mostrador sí se puede vender
 * algo que se acaba de marcar como agotado en la web.
 */

export type PricedItemInput = {
  productId: string;
  quantity: number;
  extraIds: string[];
  notes?: string;
};

export type PricedItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes: string | undefined;
  extras: { id: string; name: string; price: number }[];
};

export type PricingResult =
  | {
      ok: true;
      items: PricedItem[];
      subtotal: number;
      /**
       * Descuento por promociones automáticas (2x1, 3x2, la segunda a mitad).
       *
       * Sale de aquí y no de cada pantalla porque `priceOrderItems` es la única
       * fuente de precios del sistema: así la promoción vale igual en la caja,
       * en el checkout de la web y en el pedido manual. Calcularla solo en la
       * caja habría dejado la web cobrando el precio lleno.
       */
      descuentoPromos: number;
      promosAplicadas: PromoAplicada[];
    }
  | { ok: false; error: string };

export async function priceOrderItems(
  items: PricedItemInput[],
  options: { requireAvailable: boolean }
): Promise<PricingResult> {
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    include: { extras: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const priced: PricedItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return { ok: false, error: "Uno de los productos de tu pedido ya no está en el menú. Actualiza el carrito." };
    }
    if (options.requireAvailable && !product.available) {
      return { ok: false, error: `"${product.name}" se agotó por hoy. Quítalo del carrito para continuar.` };
    }

    // Solo se aceptan extras que existan, pertenezcan a ESE producto y estén
    // activos: así no se puede colar el extra barato de otro producto ni uno
    // desactivado desde el panel.
    const selectedExtras = product.extras.filter((e) => e.active && item.extraIds.includes(e.id));
    const extrasTotal = selectedExtras.reduce((s, e) => s + e.price, 0);

    subtotal += (product.price + extrasTotal) * item.quantity;
    priced.push({
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      notes: item.notes,
      extras: selectedExtras.map((e) => ({ id: e.id, name: e.name, price: e.price })),
    });
  }

  // Las promociones se aplican sobre el precio BASE, nunca sobre los extras: si
  // en un 2x1 a una hamburguesa le agregan queso, el queso se cobra. Regalar
  // los extras convierte una promoción calculada en una pérdida que nadie
  // previó.
  const reglas = await prisma.promocionRegla.findMany({
    where: { activa: true, productId: { in: [...productMap.keys()] } },
  });
  const vigentes = reglas.filter((r) => reglaVigente(r));

  const { descuento, aplicadas } = calcularDescuentoPromos(
    priced.map((p) => ({ productId: p.productId, cantidad: p.quantity, precioUnitario: p.unitPrice })),
    vigentes
  );

  return { ok: true, items: priced, subtotal, descuentoPromos: descuento, promosAplicadas: aplicadas };
}
