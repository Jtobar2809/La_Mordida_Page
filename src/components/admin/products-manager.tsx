"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ProductForm, type InsumoOpcion } from "@/components/admin/product-form";
import { deleteProduct, toggleProductAvailability } from "@/actions/admin/products";
import { formatCOP } from "@/lib/utils";
import type { ProductWithExtras } from "@/types/menu";

type ProductWithCategory = ProductWithExtras & { category: { name: string } };
type Category = { id: string; name: string };

export function ProductsManager({
  products,
  categories,
  insumos,
}: {
  products: ProductWithCategory[];
  categories: Category[];
  insumos: InsumoOpcion[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<ProductWithExtras | null | undefined>(undefined);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
    const result = await deleteProduct(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Producto eliminado");
    router.refresh();
  };

  const handleToggle = async (id: string, current: boolean) => {
    const result = await toggleProductAvailability(id, !current);
    if (!result.success) return toast.error(result.error);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nuevo producto
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal-100 bg-charcoal-50 text-left text-xs uppercase tracking-wide text-charcoal-400 dark:border-charcoal-700 dark:bg-charcoal-900/40">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Precio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="flex items-center gap-3 px-4 py-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-charcoal-100">
                    {product.image ? (
                      <Image src={product.image} alt={product.name} fill className="object-cover" sizes="40px" />
                    ) : (
                      <Flame className="m-2 h-6 w-6 text-charcoal-300" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-charcoal-900 dark:text-cream">{product.name}</p>
                    {product.featured && <Badge variant="mustard">Destacado</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-charcoal-500 dark:text-charcoal-300">{product.category.name}</td>
                <td className="px-4 py-3 font-mono">{formatCOP(product.price)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(product.id, product.available)}>
                    <Badge variant={product.available ? "olive" : "charcoal"}>
                      {product.available ? "Disponible" : "Pausado"}
                    </Badge>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(product)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(product.id, product.name)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="p-8 text-center text-sm text-charcoal-400">Aún no hay productos. Crea el primero.</p>}
      </div>

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? "Editar producto" : "Nuevo producto"}
      >
        <ProductForm
          product={editing ?? null}
          categories={categories}
          insumos={insumos}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
