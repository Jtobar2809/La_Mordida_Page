"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProductCard } from "@/components/menu/product-card";
import { AddToCartModal } from "@/components/menu/add-to-cart-modal";
import { cn } from "@/lib/utils";
import type { CategoryWithProducts, ProductWithExtras } from "@/types/menu";

export function MenuBrowser({ categories }: { categories: CategoryWithProducts[] }) {
  const [activeCategory, setActiveCategory] = React.useState<string>("todas");
  const [search, setSearch] = React.useState("");
  const [selectedProduct, setSelectedProduct] = React.useState<ProductWithExtras | null>(null);

  const allProducts = React.useMemo(
    () => categories.flatMap((c) => c.products.map((p) => ({ ...p, categoryName: c.name }))),
    [categories]
  );

  const filtered = React.useMemo(() => {
    return allProducts.filter((p) => {
      const matchesCategory = activeCategory === "todas" || p.categoryId === activeCategory;
      const matchesSearch =
        search.trim().length === 0 ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.ingredients.some((i) => i.toLowerCase().includes(search.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [allProducts, activeCategory, search]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory("todas")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-semibold transition-colors",
              activeCategory === "todas"
                ? "bg-ember-gradient text-white shadow-glow"
                : "bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200 dark:bg-charcoal-700 dark:text-charcoal-100"
            )}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                activeCategory === cat.id
                  ? "bg-ember-gradient text-white shadow-glow"
                  : "bg-charcoal-100 text-charcoal-600 hover:bg-charcoal-200 dark:bg-charcoal-700 dark:text-charcoal-100"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-300" />
          <Input
            placeholder="Buscar en el menú..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-charcoal-400">No encontramos nada con esa búsqueda. Prueba con otra palabra.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} onSelect={() => setSelectedProduct(product)} />
          ))}
        </div>
      )}

      <AddToCartModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
}
