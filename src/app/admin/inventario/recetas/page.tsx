import { prisma } from "@/lib/prisma";
import { RecetasManager } from "@/components/admin/recetas-manager";
import { InventarioTabs } from "@/components/admin/inventario-tabs";
import { obtenerPanoramaOperacion } from "@/lib/operacion";

export const dynamic = "force-dynamic";

export default async function AdminRecetasPage() {
  const [products, insumos, panorama] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        recetaItems: { include: { insumo: true } },
        category: { select: { name: true } },
        comboItems: { include: { producto: { include: { recetaItems: { include: { insumo: true } } } } } },
      },
    }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    obtenerPanoramaOperacion(),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">INVENTARIO · RECETAS</h1>
        <InventarioTabs />
      </div>
      {insumos.length === 0 ? (
        <p className="text-charcoal-400">Primero crea algunos insumos en la pestaña &quot;Insumos&quot; para poder armar recetas.</p>
      ) : (
        <RecetasManager
          products={products}
          insumos={insumos}
          tasaOperacion={panorama.tasaOperacion}
          motivoSinTasa={panorama.motivoSinTasa}
        />
      )}
    </div>
  );
}
