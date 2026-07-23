"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { CategoryForm } from "@/components/admin/category-form";
import { deleteCategory } from "@/actions/admin/categories";
import type { Category } from "@prisma/client";

export function CategoriesManager({ categories }: { categories: (Category & { _count: { products: number } })[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Category | null | undefined>(undefined);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    const result = await deleteCategory(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Categoría eliminada");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nueva categoría
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
            <div>
              <p className="font-semibold text-charcoal-900 dark:text-cream">{cat.name}</p>
              <p className="text-xs text-charcoal-400">{cat._count.products} producto(s)</p>
              <Badge variant={cat.active ? "olive" : "charcoal"} className="mt-1">
                {cat.active ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEditing(cat)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(cat.id, cat.name)} aria-label="Eliminar">
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "Editar categoría" : "Nueva categoría"}>
        <CategoryForm
          category={editing ?? null}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
