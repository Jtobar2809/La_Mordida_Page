"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { upsertRecetaItem, deleteRecetaItem } from "@/actions/admin/recetas";
import type { Insumo, Product, RecetaItem } from "@prisma/client";

type ProductWithReceta = Product & {
  category: { name: string };
  recetaItems: (RecetaItem & { insumo: Insumo })[];
};

const UNIDAD_LABEL: Record<string, string> = {
  GRAMOS: "g",
  KILOGRAMOS: "kg",
  MILILITROS: "ml",
  LITROS: "l",
  UNIDAD: "unidad",
};

export function RecetasManager({ products, insumos }: { products: ProductWithReceta[]; insumos: Insumo[] }) {
  const router = useRouter();
  const [productId, setProductId] = React.useState(products[0]?.id ?? "");
  const [nuevoInsumoId, setNuevoInsumoId] = React.useState(insumos[0]?.id ?? "");
  const [cantidad, setCantidad] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  const product = products.find((p) => p.id === productId);
  const costo = product?.recetaItems.reduce((total, item) => total + item.cantidad * item.insumo.costoUnitario, 0) ?? 0;
  const margen = product ? product.price - costo : 0;
  const margenPct = product && product.price > 0 ? Math.round((margen / product.price) * 100) : 0;

  const insumosDisponibles = insumos.filter((i) => !product?.recetaItems.some((ri) => ri.insumoId === i.id));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoInsumoId) return toast.error("Elige un insumo");
    setLoading(true);
    const result = await upsertRecetaItem({ productId, insumoId: nuevoInsumoId, cantidad });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Insumo agregado a la receta");
    setCantidad(1);
    router.refresh();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("¿Quitar este insumo de la receta?")) return;
    const result = await deleteRecetaItem(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Insumo quitado de la receta");
    router.refresh();
  };

  const handleUpdateCantidad = async (item: RecetaItem, nuevaCantidad: number) => {
    if (!nuevaCantidad || nuevaCantidad <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      router.refresh(); // por si el input quedó en un valor inválido, lo devolvemos al guardado
      return;
    }
    if (nuevaCantidad === item.cantidad) return;
    const result = await upsertRecetaItem({ id: item.id, productId: item.productId, insumoId: item.insumoId, cantidad: nuevaCantidad });
    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Cantidad actualizada");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-1">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setProductId(p.id)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
              p.id === productId ? "bg-ember-gradient text-white shadow-glow" : "text-charcoal-700 hover:bg-charcoal-100 dark:text-cream dark:hover:bg-charcoal-700/50"
            }`}
          >
            <span>
              {p.name}
              <span className="block text-xs opacity-70">{p.category.name}</span>
            </span>
            <Badge variant={p.recetaItems.length > 0 ? "olive" : "charcoal"}>{p.recetaItems.length}</Badge>
          </button>
        ))}
      </div>

      {product && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
            <div>
              <p className="font-display text-lg text-charcoal-900 dark:text-cream">{product.name}</p>
              <p className="text-xs text-charcoal-400">Precio de venta: ${product.price.toLocaleString("es-CO")}</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-charcoal-400">Costo receta</p>
                <p className="font-semibold text-charcoal-900 dark:text-cream">${costo.toLocaleString("es-CO")}</p>
              </div>
              <div>
                <p className="text-charcoal-400">Margen</p>
                <p className={`font-semibold ${margen < 0 ? "text-red-500" : "text-olive-600 dark:text-olive-400"}`}>
                  ${margen.toLocaleString("es-CO")} ({margenPct}%)
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
                <tr>
                  <th className="px-4 py-3">Insumo</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Costo parcial</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
                {product.recetaItems.map((item) => (
                  <tr key={item.id} className="bg-white dark:bg-charcoal-800">
                    <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">{item.insumo.nombre}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          key={`${item.id}-${item.cantidad}`}
                          type="number"
                          step="any"
                          min={0}
                          defaultValue={item.cantidad}
                          onBlur={(e) => handleUpdateCantidad(item, Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="w-20 rounded-lg border border-charcoal-200 bg-transparent px-2 py-1 text-sm focus:border-ember-500 focus:outline-none dark:border-charcoal-600 dark:text-cream"
                        />
                        <span className="text-xs text-charcoal-400">{UNIDAD_LABEL[item.insumo.unidad]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">${(item.cantidad * item.insumo.costoUnitario).toLocaleString("es-CO")}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => handleRemove(item.id)} aria-label="Quitar">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {product.recetaItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-charcoal-400">
                      Este producto todavía no tiene receta. Agrega insumos abajo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {insumosDisponibles.length > 0 ? (
            <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-charcoal-200 p-4 dark:border-charcoal-600">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-charcoal-400">Insumo</label>
                <Select value={nuevoInsumoId} onChange={(e) => setNuevoInsumoId(e.target.value)}>
                  {insumosDisponibles.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({UNIDAD_LABEL[i.unidad]})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-charcoal-400">Cantidad</label>
                <Input type="number" step="any" min={0} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
              </div>
              <Button type="submit" disabled={loading}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-charcoal-400">Todos los insumos activos ya están en esta receta.</p>
          )}
        </div>
      )}
    </div>
  );
}
