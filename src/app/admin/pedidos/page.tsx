import { prisma } from "@/lib/prisma";
import { OrdersTable } from "@/components/admin/orders-table";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true, phone: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">PEDIDOS</h1>
      <OrdersTable orders={orders} />
    </div>
  );
}
