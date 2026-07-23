"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { upsertProduct } from "@/actions/admin/products";
import type { ProductWithExtras } from "@/types/menu";

type Category = { id: string; name: string };

export function ProductForm({
  product,
  categories,
  onDone,
}: {
  product: ProductWithExtras | null;
  categories: Category[];
  onDone: () => void;
}) {
  const [form, setForm] = React.useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price ?? 0,
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    image: product?.image ?? "",
    featured: product?.featured ?? false,
    available: product?.available ?? true,
    spicyLevel: product?.spicyLevel ?? 0,
  });
  const [ingredients, setIngredients] = React.useState<string[]>(product?.ingredients ?? []);
  const [ingredientInput, setIngredientInput] = React.useState("");
  const [extras, setExtras] = React.useState(product?.extras.map((e) => ({ name: e.name, price: e.price })) ?? []);
  const [loading, setLoading] = React.useState(false);

  const addIngredient = () => {
    if (!ingredientInput.trim()) return;
    setIngredients((prev) => [...prev, ingredientInput.trim()]);
    setIngredientInput("");
  };

  const addExtra = () => setExtras((prev) => [...prev, { name: "", price: 0 }]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertProduct({
      id: product?.id,
      ...form,
      ingredients,
      extras: extras.filter((ex) => ex.name.trim().length > 0),
    });
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(product ? "Producto actualizado" : "Producto creado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Precio (COP)</Label>
          <Input id="price" type="number" required min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="category">Categoría</Label>
          <Select id="category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <ImageUploader value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Foto del producto" />
      </div>
      <div>
        <Label htmlFor="spicy">Nivel picante (0-3)</Label>
        <Input id="spicy" type="number" min={0} max={3} value={form.spicyLevel} onChange={(e) => setForm({ ...form, spicyLevel: Number(e.target.value) })} />
      </div>

      <div>
        <Label>Ingredientes</Label>
        <div className="flex gap-2">
          <Input
            value={ingredientInput}
            onChange={(e) => setIngredientInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addIngredient();
              }
            }}
            placeholder="Ej: queso cheddar"
          />
          <Button type="button" variant="secondary" onClick={addIngredient}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ingredients.map((ing, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-charcoal-100 px-2.5 py-1 text-xs dark:bg-charcoal-700">
              {ing}
              <button type="button" onClick={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="mb-0">Extras</Label>
          <Button type="button" size="sm" variant="secondary" onClick={addExtra}>
            <Plus className="h-3.5 w-3.5" /> Agregar extra
          </Button>
        </div>
        <div className="space-y-2">
          {extras.map((extra, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Nombre del extra"
                value={extra.name}
                onChange={(e) => setExtras((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, name: e.target.value } : ex)))}
              />
              <Input
                type="number"
                placeholder="Precio"
                className="w-28"
                value={extra.price}
                onChange={(e) => setExtras((prev) => prev.map((ex, idx) => (idx === i ? { ...ex, price: Number(e.target.value) } : ex)))}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => setExtras((prev) => prev.filter((_, idx) => idx !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="h-4 w-4 accent-ember-600" />
          Destacado en inicio
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} className="h-4 w-4 accent-ember-600" />
          Disponible
        </label>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : product ? "Guardar cambios" : "Crear producto"}
      </Button>
    </form>
  );
}
