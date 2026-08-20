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

type FormFields = {
  name: string;
  description: string;
  price: number;
  categoryId: string;
  image: string;
  featured: boolean;
  available: boolean;
  esCombo: boolean;
  spicyLevel: number;
};

const BASE_FIELDS = [
  "name",
  "description",
  "price",
  "categoryId",
  "image",
  "featured",
  "available",
  "esCombo",
  "spicyLevel",
] as const;
type BaseField = (typeof BASE_FIELDS)[number];

/**
 * Formulario de producto. Al EDITAR (product !== null), solo los campos
 * que el usuario realmente toca durante esta sesión de edición se
 * incluyen en el payload enviado al servidor — el resto se omite, y el
 * servidor conserva sus valores actuales en la base de datos. No hace
 * falta re-rellenar ni volver a confirmar todo el producto para cambiar
 * un solo dato (por ejemplo, solo el precio).
 *
 * Al CREAR (product === null) se envían siempre todos los campos, ya
 * que no hay "valor actual" que preservar.
 */
export type InsumoOpcion = { id: string; nombre: string; unidad: string };

/**
 * Convierte los extras del formulario al formato que espera el server action:
 * descarta los que no tienen nombre y omite la receta cuando está incompleta,
 * para que un extra a medio configurar se guarde como "no descuenta" en vez de
 * hacer fallar todo el guardado del producto.
 */
function extrasParaEnviar(extras: ExtraEditable[]) {
  return extras
    .filter((extra) => extra.name.trim().length > 0)
    .map((extra) => {
      const cantidad = Number(extra.cantidadInsumo);
      const tieneReceta = extra.insumoId !== "" && Number.isFinite(cantidad) && cantidad > 0;
      return {
        name: extra.name.trim(),
        price: extra.price,
        insumoId: tieneReceta ? extra.insumoId : undefined,
        cantidadInsumo: tieneReceta ? cantidad : undefined,
      };
    });
}

/** Un extra tal como se edita en el formulario, con su receta opcional. */
type ExtraEditable = {
  name: string;
  price: number;
  insumoId: string;
  cantidadInsumo: string;
};

export function ProductForm({
  product,
  categories,
  insumos,
  onDone,
}: {
  product: ProductWithExtras | null;
  categories: Category[];
  insumos: InsumoOpcion[];
  onDone: () => void;
}) {
  const isEditing = product !== null;

  const [form, setForm] = React.useState<FormFields>({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price ?? 0,
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    image: product?.image ?? "",
    featured: product?.featured ?? false,
    available: product?.available ?? true,
    esCombo: product?.esCombo ?? false,
    spicyLevel: product?.spicyLevel ?? 0,
  });
  const [ingredients, setIngredients] = React.useState<string[]>(product?.ingredients ?? []);
  const [ingredientInput, setIngredientInput] = React.useState("");
  const [extras, setExtras] = React.useState<ExtraEditable[]>(
    product?.extras.map((e) => ({
      name: e.name,
      price: e.price,
      insumoId: e.insumoId ?? "",
      cantidadInsumo: e.cantidadInsumo === null ? "" : String(e.cantidadInsumo),
    })) ?? []
  );
  const [loading, setLoading] = React.useState(false);

  // Campos que el usuario modificó realmente durante esta edición.
  // Vacío hasta que haya un cambio explícito — así "abrir para editar
  // y guardar sin tocar nada" no reescribe absolutamente nada.
  const dirtyFields = React.useRef<Set<BaseField>>(new Set());
  const ingredientsDirty = React.useRef(false);
  const extrasDirty = React.useRef(false);

  function updateField<K extends BaseField>(key: K, value: FormFields[K]) {
    dirtyFields.current.add(key);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const addIngredient = () => {
    if (!ingredientInput.trim()) return;
    ingredientsDirty.current = true;
    setIngredients((prev) => [...prev, ingredientInput.trim()]);
    setIngredientInput("");
  };
  const removeIngredient = (idx: number) => {
    ingredientsDirty.current = true;
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const addExtra = () => {
    extrasDirty.current = true;
    setExtras((prev) => [...prev, { name: "", price: 0, insumoId: "", cantidadInsumo: "" }]);
  };
  const updateExtra = (idx: number, patch: Partial<ExtraEditable>) => {
    extrasDirty.current = true;
    setExtras((prev) => prev.map((ex, i) => (i === idx ? { ...ex, ...patch } : ex)));
  };
  const removeExtra = (idx: number) => {
    extrasDirty.current = true;
    setExtras((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let payload: Record<string, unknown>;

    if (isEditing) {
      // PATCH parcial: solo los campos realmente tocados van en el payload.
      payload = { id: product.id };
      for (const key of dirtyFields.current) {
        payload[key] = form[key];
      }
      if (ingredientsDirty.current) payload.ingredients = ingredients;
      if (extrasDirty.current) payload.extras = extrasParaEnviar(extras);
    } else {
      payload = {
        ...form,
        ingredients,
        extras: extrasParaEnviar(extras),
      };
    }

    const result = await upsertProduct(payload);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(isEditing ? "Producto actualizado" : "Producto creado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          required={!isEditing}
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          required={!isEditing}
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Precio (COP)</Label>
          <Input
            id="price"
            type="number"
            required={!isEditing}
            min={0}
            value={form.price}
            onChange={(e) => updateField("price", Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="category">Categoría</Label>
          <Select id="category" value={form.categoryId} onChange={(e) => updateField("categoryId", e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <ImageUploader value={form.image} onChange={(url) => updateField("image", url)} label="Foto del producto" />
      </div>
      <div>
        <Label htmlFor="spicy">Nivel picante (0-3)</Label>
        <Input
          id="spicy"
          type="number"
          min={0}
          max={3}
          value={form.spicyLevel}
          onChange={(e) => updateField("spicyLevel", Number(e.target.value))}
        />
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
              <button type="button" onClick={() => removeIngredient(i)}>
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

        {extras.length > 0 && (
          <p className="mb-2 text-xs text-charcoal-400">
            Indica qué insumo consume cada extra para que la venta lo descuente del inventario. Si lo dejas vacío, el
            extra se cobra pero no descuenta nada.
          </p>
        )}

        <div className="space-y-3">
          {extras.map((extra, i) => {
            const insumo = insumos.find((ins) => ins.id === extra.insumoId);
            return (
              <div key={i} className="rounded-xl border border-charcoal-100 p-3 dark:border-charcoal-700">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre del extra"
                    value={extra.name}
                    onChange={(e) => updateExtra(i, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Precio"
                    className="w-28"
                    value={extra.price}
                    onChange={(e) => updateExtra(i, { price: Number(e.target.value) })}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeExtra(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-2 flex gap-2">
                  <Select
                    value={extra.insumoId}
                    onChange={(e) => updateExtra(i, { insumoId: e.target.value })}
                    className="h-9 text-sm"
                    aria-label={`Insumo que consume ${extra.name || "el extra"}`}
                  >
                    <option value="">Sin insumo (no descuenta)</option>
                    {insumos.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nombre}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    placeholder={insumo ? insumo.unidad.toLowerCase() : "cantidad"}
                    className="h-9 w-36 text-sm"
                    value={extra.cantidadInsumo}
                    onChange={(e) => updateExtra(i, { cantidadInsumo: e.target.value })}
                    disabled={!extra.insumoId}
                    aria-label={`Cantidad de insumo por ${extra.name || "extra"}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => updateField("featured", e.target.checked)}
            className="h-4 w-4 accent-ember-600"
          />
          Destacado en inicio
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => updateField("available", e.target.checked)}
            className="h-4 w-4 accent-ember-600"
          />
          Disponible
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.esCombo}
          onChange={(e) => updateField("esCombo", e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-ember-600"
        />
        <span>
          Es un combo (se arma con otros productos del menú)
          <span className="block text-xs text-charcoal-400">
            Qué lleva adentro se define después en Inventario › Recetas. El costo sale solo de las recetas de esos
            productos, y al venderlo el inventario descuenta todo lo que llevan.
          </span>
        </span>
      </label>

      {isEditing && (
        <p className="text-xs text-charcoal-400">
          Solo se guardarán los campos que modifiques. Lo que no toques queda igual.
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear producto"}
      </Button>
    </form>
  );
}
