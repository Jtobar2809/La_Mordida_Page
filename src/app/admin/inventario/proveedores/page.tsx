import { prisma } from "@/lib/prisma";
import { ProveedoresManager } from "@/components/admin/proveedores-manager";
import { InventarioTabs } from "@/components/admin/inventario-tabs";

export const dynamic = "force-dynamic";

export default async function AdminProveedoresPage() {
  const proveedores = await prisma.proveedor.findMany({ orderBy: { nombre: "asc" } });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">INVENTARIO · PROVEEDORES</h1>
        <InventarioTabs />
      </div>
      <ProveedoresManager proveedores={proveedores} />
    </div>
  );
}
