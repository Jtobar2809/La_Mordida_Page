"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { upsertCategory } from "@/actions/admin/categories";
import type { Category } from "@prisma/client";

export function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    name: category?.name ?? "",
    icon: category?.icon ?? "",
    order: category?.order ?? 0,
    active: category?.active ?? true,
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertCategory({ id: category?.id, ...form });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success(category ? "Categoría actualizada" : "Categoría creada");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Hamburguesas" />
      </div>
      <div>
        <Label htmlFor="icon">Ícono (nombre de lucide-react, opcional)</Label>
        <Input id="icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Ej: beef" />
      </div>
      <div>
        <Label htmlFor="order">Orden de aparición</Label>
        <Input id="order" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-ember-600" />
        Activa (visible en el menú)
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : category ? "Guardar cambios" : "Crear categoría"}
      </Button>
    </form>
  );
}
