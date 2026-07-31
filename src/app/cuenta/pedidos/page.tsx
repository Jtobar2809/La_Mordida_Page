import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatCOP } from "@/lib/utils";

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

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } },
  });

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">MIS PEDIDOS</h1>

      {orders.length === 0 ? (
        <Card className="p-6 text-center text-sm text-charcoal-400">Todavía no has hecho ningún pedido.</Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
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

              <div className="mt-3 flex items-center justify-end border-t border-charcoal-100 pt-3 dark:border-charcoal-700">
                <span className="font-mono font-bold text-ember-600">{formatCOP(order.total)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
