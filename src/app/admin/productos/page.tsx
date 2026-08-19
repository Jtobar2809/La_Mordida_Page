import { prisma } from "@/lib/prisma";
import { ProductsManager } from "@/components/admin/products-manager";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, categories, insumos] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { extras: true, category: { select: { name: true } } },
    }),
    prisma.category.findMany({ orderBy: { order: "asc" } }),
    // Para poder decir qué insumo consume cada extra y que la venta lo descuente.
    prisma.insumo.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, unidad: true },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">PRODUCTOS</h1>
      <ProductsManager products={products} categories={categories} insumos={insumos} />
    </div>
  );
}
