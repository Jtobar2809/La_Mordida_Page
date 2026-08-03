import { prisma } from "@/lib/prisma";
import { InsumosManager } from "@/components/admin/insumos-manager";
import { InventarioTabs } from "@/components/admin/inventario-tabs";

export const dynamic = "force-dynamic";

export default async function AdminInventarioPage() {
  const [insumos, proveedores] = await Promise.all([
    prisma.insumo.findMany({
      orderBy: { nombre: "asc" },
      include: {
        proveedorPrincipal: { select: { nombre: true } },
        composicion: { include: { insumoBase: true } },
      },
    }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">INVENTARIO · INSUMOS</h1>
        <InventarioTabs />
      </div>
      <InsumosManager insumos={insumos} proveedores={proveedores} />
    </div>
  );
}
