"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { upsertReward } from "@/actions/admin/rewards";
import type { Reward } from "@prisma/client";

export function RewardForm({ reward, onDone }: { reward: Reward | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    name: reward?.name ?? "",
    description: reward?.description ?? "",
    pointsCost: reward?.pointsCost ?? 50,
    stock: reward?.stock ?? undefined,
    image: reward?.image ?? "",
    active: reward?.active ?? true,
  });
  const [unlimited, setUnlimited] = React.useState(reward?.stock === null || reward?.stock === undefined);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertReward({
      id: reward?.id,
      ...form,
      stock: unlimited ? undefined : form.stock,
    });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success(reward ? "Recompensa actualizada" : "Recompensa creada");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Hamburguesa clásica gratis" />
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <ImageUploader value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Foto de la recompensa (opcional)" />
      </div>
      <div>
        <Label htmlFor="pointsCost">Costo en puntos</Label>
        <Input id="pointsCost" type="number" min={1} required value={form.pointsCost} onChange={(e) => setForm({ ...form, pointsCost: Number(e.target.value) })} />
      </div>
      <div>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} className="h-4 w-4 accent-ember-600" />
          Stock ilimitado
        </label>
        {!unlimited && (
          <Input
            type="number"
            min={0}
            placeholder="Cantidad disponible"
            value={form.stock ?? 0}
            onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
          />
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-ember-600" />
        Visible para los clientes
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : reward ? "Guardar cambios" : "Crear recompensa"}
      </Button>
    </form>
  );
}
