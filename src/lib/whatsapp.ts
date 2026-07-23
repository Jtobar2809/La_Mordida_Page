import { formatCOP } from "@/lib/utils";

export type WhatsappOrderItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  extras?: { name: string; price: number }[];
};

export function buildWhatsappOrderMessage(params: {
  orderId: string;
  customerName: string;
  items: WhatsappOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  deliveryType: "DOMICILIO" | "RECOGE_EN_TIENDA";
  address?: string;
  notes?: string;
}) {
  const { orderId, customerName, items, subtotal, deliveryFee, discount, total, deliveryType, address, notes } =
    params;

  const lines: string[] = [];
  lines.push(`🔥 *Nuevo pedido — La Mordida*`);
  lines.push(`Pedido: #${orderId.slice(-6).toUpperCase()}`);
  lines.push(`Cliente: ${customerName}`);
  lines.push("");
  lines.push("*Productos:*");
  for (const item of items) {
    lines.push(`• ${item.quantity}x ${item.name} — ${formatCOP(item.unitPrice * item.quantity)}`);
    if (item.extras?.length) {
      for (const extra of item.extras) {
        lines.push(`   + ${extra.name}${extra.price ? ` (${formatCOP(extra.price)})` : ""}`);
      }
    }
    if (item.notes) lines.push(`   Nota: ${item.notes}`);
  }
  lines.push("");
  lines.push(`Subtotal: ${formatCOP(subtotal)}`);
  if (discount > 0) lines.push(`Descuento: -${formatCOP(discount)}`);
  if (deliveryType === "DOMICILIO") lines.push(`Domicilio: ${formatCOP(deliveryFee)}`);
  lines.push(`*Total: ${formatCOP(total)}*`);
  lines.push("");
  lines.push(deliveryType === "DOMICILIO" ? "🛵 Entrega a domicilio" : "🏠 Recoge en tienda");
  if (address) lines.push(`Dirección: ${address}`);
  if (notes) lines.push(`Notas: ${notes}`);

  return lines.join("\n");
}

export function buildWhatsappLink(phoneNumber: string, message: string) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${encoded}`;
}
