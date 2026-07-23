import { prisma } from "@/lib/prisma";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CATEGORÍAS</h1>
      <CategoriesManager categories={categories} />
    </div>
  );
}
