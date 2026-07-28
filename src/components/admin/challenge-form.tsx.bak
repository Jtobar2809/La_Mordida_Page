"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { upsertChallenge } from "@/actions/admin/challenges";
import type { Challenge } from "@prisma/client";

const typeLabels: Record<string, string> = {
  CANTIDAD_PRODUCTO: "Comprar N productos en total",
  PEDIDOS_TOTALES: "Realizar N pedidos",
  RACHA_SEMANAS: "Comprar N semanas seguidas",
  REFERIDO: "Invitar un amigo",
  PRODUCTO_NUEVO: "Comprar un producto nuevo",
  CUMPLEANOS: "Comprar en el mes de cumpleaños",
  CATEGORIA_COMPLETA: "Comprar de todas las categorías",
  COMBO: "Comprar un combo específico",
};

export function ChallengeForm({ challenge, onDone }: { challenge: Challenge | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    title: challenge?.title ?? "",
    description: challenge?.description ?? "",
    type: challenge?.type ?? "PEDIDOS_TOTALES",
    goal: challenge?.goal ?? 1,
    rewardPoints: challenge?.rewardPoints ?? 0,
    rewardDescription: challenge?.rewardDescription ?? "",
    active: challenge?.active ?? true,
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertChallenge({ id: challenge?.id, ...form });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success(challenge ? "Desafío actualizado" : "Desafío creado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Título</Label>
        <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: Compra 5 hamburguesas" />
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="type">Tipo de desafío</Label>
        <Select id="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Challenge["type"] })}>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="goal">Meta</Label>
          <Input id="goal" type="number" min={1} required value={form.goal} onChange={(e) => setForm({ ...form, goal: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="rewardPoints">Puntos de premio</Label>
          <Input id="rewardPoints" type="number" min={0} value={form.rewardPoints} onChange={(e) => setForm({ ...form, rewardPoints: Number(e.target.value) })} />
        </div>
      </div>
      <div>
        <Label htmlFor="rewardDescription">Premio adicional (opcional)</Label>
        <Input id="rewardDescription" value={form.rewardDescription} onChange={(e) => setForm({ ...form, rewardDescription: e.target.value })} placeholder="Ej: Papas gratis" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-ember-600" />
        Desafío activo
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : challenge ? "Guardar cambios" : "Crear desafío"}
      </Button>
    </form>
  );
}
