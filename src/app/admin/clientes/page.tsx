import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  const customers = await prisma.user.findMany({
    where: { role: "CLIENTE" },
    orderBy: { points: "desc" },
    take: 200,
    include: { level: true, _count: { select: { orders: true } } },
  });

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CLIENTES</h1>
      <p className="mb-6 text-sm text-charcoal-400">{customers.length} cliente(s) registrados</p>

      <div className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal-100 bg-charcoal-50 text-left text-xs uppercase tracking-wide text-charcoal-400 dark:border-charcoal-700 dark:bg-charcoal-900/40">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Nivel</th>
              <th className="px-4 py-3">Puntos</th>
              <th className="px-4 py-3">Pedidos</th>
              <th className="px-4 py-3">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-semibold text-charcoal-900 dark:text-cream">{c.name}</td>
                <td className="px-4 py-3 text-charcoal-500 dark:text-charcoal-300">
                  <p>{c.email}</p>
                  <p className="text-xs text-charcoal-400">{c.phone}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="ember" style={{ backgroundColor: `${c.level?.color}20`, color: c.level?.color }}>
                    {c.level?.name ?? "Bronce"}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono font-bold text-ember-600">{c.points}</td>
                <td className="px-4 py-3">{c._count.orders}</td>
                <td className="px-4 py-3 text-charcoal-400">{formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && <p className="p-8 text-center text-sm text-charcoal-400">Aún no hay clientes registrados.</p>}
      </div>
    </div>
  );
}
