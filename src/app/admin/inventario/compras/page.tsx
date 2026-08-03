import { prisma } from "@/lib/prisma";
import { ComprasManager } from "@/components/admin/compras-manager";
import { InventarioTabs } from "@/components/admin/inventario-tabs";

export const dynamic = "force-dynamic";

export default async function AdminComprasPage() {
  const [compras, proveedores, insumos] = await Promise.all([
    prisma.compra.findMany({
      orderBy: { fecha: "desc" },
      take: 100,
      include: { proveedor: { select: { nombre: true } }, items: true },
    }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.insumo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">INVENTARIO · COMPRAS</h1>
        <InventarioTabs />
      </div>
      {proveedores.length === 0 ? (
        <p className="text-charcoal-400">Primero crea un proveedor en la pestaña &quot;Proveedores&quot; para poder registrar compras.</p>
      ) : (
        <ComprasManager compras={compras} proveedores={proveedores} insumos={insumos} />
      )}
    </div>
  );
}
