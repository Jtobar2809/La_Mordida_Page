import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { SalesChart } from "@/components/admin/sales-chart";
import { TopProductsChart } from "@/components/admin/top-products-chart";
import { EquilibrioPanel } from "@/components/admin/equilibrio-panel";
import { formatCOP } from "@/lib/utils";
import { EXCLUIR_CLIENTE_MOSTRADOR } from "@/lib/caja";
import { obtenerPanoramaOperacion } from "@/lib/operacion";
import { DollarSign, Users, Receipt, Stamp, TrendingUp, Gift } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const [
    salesAgg,
    ordersThisMonth,
    newCustomers,
    stampsGivenCount,
    rewardsReadyCount,
    ordersLast14Days,
    topProductsRaw,
    frequentCustomers,
    panorama,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { not: "CANCELADO" }, createdAt: { gte: startOfMonth } },
      _sum: { total: true },
      _avg: { total: true },
      _count: true,
    }),
    // Sin los cancelados, igual que "Ventas del mes" y "Ticket promedio". Antes
    // los contaba, así que las tarjetas no cuadraban entre sí: 3 pedidos y
    // $80.000 daban un ticket de $26.667, pero la tarjeta mostraba $40.000
    // porque el promedio sí excluía el cancelado.
    prisma.order.count({ where: { status: { not: "CANCELADO" }, createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { role: "CLIENTE", createdAt: { gte: startOfMonth }, ...EXCLUIR_CLIENTE_MOSTRADOR } }),
    prisma.stampQR.count({ where: { status: "RECLAMADO" } }),
    prisma.stampCard.count({ where: { rewardReady: true } }),
    prisma.order.findMany({
      where: { status: { not: "CANCELADO" }, createdAt: { gte: fourteenDaysAgo } },
      select: { total: true, createdAt: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    prisma.user.count({
      // Se excluye el cliente genérico del mostrador: agrupa cientos de ventas
      // de personas distintas y aparecería como el cliente más frecuente.
      where: { role: "CLIENTE", orders: { some: {} }, ...EXCLUIR_CLIENTE_MOSTRADOR },
    }),
    // La misma fuente que usa Inventario › Costos fijos, para que las dos
    // pantallas no puedan mostrar puntos de equilibrio distintos.
    obtenerPanoramaOperacion(),
  ]);

  const productIds = topProductsRaw.map((p) => p.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const topProducts = topProductsRaw.map((p) => ({
    name: products.find((prod) => prod.id === p.productId)?.name ?? "—",
    unidades: p._sum.quantity ?? 0,
  }));

  const salesByDay = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    salesByDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const order of ordersLast14Days) {
    const key = order.createdAt.toISOString().slice(0, 10);
    salesByDay.set(key, (salesByDay.get(key) ?? 0) + order.total);
  }
  const chartData = Array.from(salesByDay.entries()).map(([date, total]) => ({
    label: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit" }).format(new Date(date)),
    total,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">DASHBOARD</h1>
        <p className="text-sm text-charcoal-400">Resumen del mes en curso</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ventas del mes" value={formatCOP(salesAgg._sum.total ?? 0)} icon={DollarSign} />
        <StatCard label="Pedidos del mes" value={String(ordersThisMonth)} icon={Receipt} accent="mustard" />
        <StatCard label="Clientes nuevos" value={String(newCustomers)} icon={Users} accent="olive" />
        <StatCard label="Ticket promedio" value={formatCOP(Math.round(salesAgg._avg.total ?? 0))} icon={TrendingUp} />
        <StatCard label="Sellos entregados" value={String(stampsGivenCount)} icon={Stamp} accent="mustard" />
        <StatCard label="Recompensas por entregar" value={String(rewardsReadyCount)} icon={Gift} accent="olive" />
        <StatCard label="Clientes frecuentes" value={String(frequentCustomers)} icon={Users} />
      </div>

      <EquilibrioPanel panorama={panorama} ventasDelMes={salesAgg._sum.total ?? 0} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800 lg:col-span-2">
          <h2 className="mb-4 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">VENTAS · ÚLTIMOS 14 DÍAS</h2>
          <SalesChart data={chartData} />
        </div>
        <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
          <h2 className="mb-4 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">PRODUCTOS MÁS VENDIDOS</h2>
          {topProducts.length > 0 ? (
            <TopProductsChart data={topProducts} />
          ) : (
            <p className="py-10 text-center text-sm text-charcoal-400">Aún no hay suficientes datos.</p>
          )}
        </div>
      </div>
    </div>
  );
}
