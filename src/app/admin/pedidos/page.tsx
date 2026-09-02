import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/orders-table";
import { ManualOrderButton } from "@/components/admin/manual-order-modal";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [orders, products] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true, phone: true } },
        items: { include: { product: { select: { name: true } } } },
        // Solo para saber si su plata ya entró a un turno. Un pedido web sin
        // esto es una venta que ningún saldo vio.
        movimientosCaja: { where: { tipo: "VENTA" }, select: { id: true } },
      },
    }),
    prisma.product.findMany({
      where: { available: true },
      include: { extras: { where: { active: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">PEDIDOS</h1>
        <ManualOrderButton products={products} />
      </div>
      <OrdersTable orders={orders.map((o) => ({ ...o, pagado: o.movimientosCaja.length > 0 }))} />
    </div>
  );
}
