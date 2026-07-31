import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { buildWhatsappOrderMessage, buildWhatsappLink } from "@/lib/whatsapp";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatCOP } from "@/lib/utils";
import { MessageCircle } from "lucide-react";

const statusVariant: Record<string, "ember" | "mustard" | "olive" | "charcoal"> = {
  PENDIENTE: "mustard",
  CONFIRMADO: "ember",
  EN_PREPARACION: "ember",
  EN_CAMINO: "ember",
  ENTREGADO: "olive",
  CANCELADO: "charcoal",
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [orders, settings] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } } },
    }),
    getSettings(),
  ]);

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">MIS PEDIDOS</h1>

      {orders.length === 0 ? (
        <Card className="p-6 text-center text-sm text-charcoal-400">Todavía no has hecho ningún pedido.</Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            // Reconstruye el enlace de WhatsApp por si el envío automático al
            // pagar fue bloqueado por el navegador (pasa sobre todo del segundo
            // pedido en adelante, cuando el popup blocker ya no confía en la
            // ventana abierta tras el `await` de crear la orden). Este enlace
            // se abre con un clic real, así que nunca lo bloquea el navegador.
            const whatsappUrl = buildWhatsappLink(
              settings.whatsappNumber,
              buildWhatsappOrderMessage({
                orderId: order.id,
                customerName: session.user.name ?? "Cliente",
                items: order.items.map((item) => ({
                  name: item.product?.name ?? "Producto no disponible",
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  notes: item.notes ?? undefined,
                  extras: Array.isArray(item.extras) ? (item.extras as { name: string; price: number }[]) : [],
                })),
                subtotal: order.subtotal,
                deliveryFee: order.deliveryFee,
                discount: order.discount,
                total: order.total,
                deliveryType: order.deliveryType,
                address: order.address ?? undefined,
                notes: order.notes ?? undefined,
              })
            );

            return (
            <Card key={order.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-charcoal-900 dark:text-cream">Pedido #{order.id.slice(-6).toUpperCase()}</p>
                  <p className="text-xs text-charcoal-400">{formatDateTime(order.createdAt)}</p>
                </div>
                <Badge variant={statusVariant[order.status] ?? "charcoal"}>{order.status.replaceAll("_", " ")}</Badge>
              </div>

              <ul className="mt-3 space-y-1 border-t border-charcoal-100 pt-3 text-sm text-charcoal-500 dark:border-charcoal-700 dark:text-charcoal-300">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}x {item.product?.name ?? "Producto no disponible"}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-charcoal-100 pt-3 dark:border-charcoal-700">
                {order.status === "PENDIENTE" ? (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-2">
                      <MessageCircle className="h-4 w-4" /> Confirmar por WhatsApp
                    </Button>
                  </a>
                ) : (
                  <span />
                )}
                <span className="font-mono font-bold text-ember-600">{formatCOP(order.total)}</span>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
