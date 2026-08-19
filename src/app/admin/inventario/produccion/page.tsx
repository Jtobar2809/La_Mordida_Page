import { prisma } from "@/lib/prisma";
import { InventarioTabs } from "@/components/admin/inventario-tabs";
import { ProduccionManager } from "@/components/admin/produccion-manager";

export const dynamic = "force-dynamic";

export default async function AdminProduccionPage() {
  const [elaborados, historial] = await Promise.all([
    prisma.insumo.findMany({
      where: { esElaborado: true, activo: true },
      orderBy: { nombre: "asc" },
      include: { composicion: { include: { insumoBase: true }, orderBy: { cantidad: "desc" } } },
    }),
    prisma.produccion.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { insumoElaborado: { select: { nombre: true, unidad: true } } },
    }),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
          INVENTARIO · PRODUCCIÓN
        </h1>
        <InventarioTabs />
      </div>

      <p className="mb-6 max-w-3xl text-sm text-charcoal-500 dark:text-charcoal-300">
        Cuando preparas una tanda de un insumo elaborado (aderezo, cebolla caramelizada), regístrala aquí: el sistema
        suma esa cantidad al stock del elaborado y descuenta los insumos base que se usaron, calculando cuánto costó
        realmente el lote.
      </p>

      <ProduccionManager elaborados={elaborados} historial={historial} />
    </div>
  );
}
