import { prisma } from "@/lib/prisma";
import { InventarioTabs } from "@/components/admin/inventario-tabs";
import { ConsumoManager } from "@/components/admin/consumo-manager";

export const dynamic = "force-dynamic";

export default async function AdminConsumoPage() {
  const [insumos, historial] = await Promise.all([
    prisma.insumo.findMany({ where: { activo: true, consumoManual: true }, orderBy: { nombre: "asc" } }),
    prisma.movimientoInsumo.findMany({
      where: { tipo: "SALIDA", orderId: null, produccionId: null, insumo: { consumoManual: true } },
      include: { insumo: { select: { nombre: true, unidad: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
          INVENTARIO · CONSUMO DE DESECHABLES
        </h1>
        <InventarioTabs />
      </div>

      <p className="mb-5 max-w-3xl text-sm text-charcoal-400">
        Las bolsas, el papel y los empaques no pueden ir en la receta de un plato: cuando se cocina una hamburguesa
        todavía no se sabe si es para llevar o para comer en el sitio, y la que se come en la mesa no usa bolsa. Por eso
        se descuentan aquí, a mano. Anota al cerrar lo que gastaste en el día y le das a descontar una sola vez.
      </p>

      <ConsumoManager insumos={insumos} historial={historial} />
    </div>
  );
}
