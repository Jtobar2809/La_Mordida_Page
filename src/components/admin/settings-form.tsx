"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateSettings } from "@/actions/admin/settings";
import type { DEFAULT_SETTINGS } from "@/lib/settings";

type Settings = typeof DEFAULT_SETTINGS;

export function SettingsForm({ settings }: { settings: Settings }) {
  const [form, setForm] = React.useState(settings);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await updateSettings(form);
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success("Configuración guardada");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">PEDIDOS</h2>
        <div>
          <Label htmlFor="deliveryFee">Costo de domicilio (COP)</Label>
          <Input id="deliveryFee" type="number" min={0} value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="taxRate">Impuesto (%)</Label>
          <Input id="taxRate" type="number" min={0} max={100} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="whatsappNumber">Número de WhatsApp (con código de país, sin +)</Label>
          <Input id="whatsappNumber" value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} placeholder="573000000000" />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">TIENDA</h2>
        <div>
          <Label htmlFor="storeAddress">Dirección</Label>
          <Input id="storeAddress" value={form.storeAddress} onChange={(e) => setForm({ ...form, storeAddress: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="storeSchedule">Horario</Label>
          <Input id="storeSchedule" value={form.storeSchedule} onChange={(e) => setForm({ ...form, storeSchedule: e.target.value })} />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">FUNCIONALIDADES</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              id="carouselEnabled"
              type="checkbox"
              checked={form.carouselEnabled === "true"}
              onChange={(e) => setForm({ ...form, carouselEnabled: e.target.checked ? "true" : "false" })}
              className="h-4 w-4 accent-ember-600"
            />
            Mostrar carrusel (Hero) en la página principal
          </label>
        </div>
      </Card>

      <Button type="submit" disabled={loading} size="lg" className="w-full">
        {loading ? "Guardando..." : "Guardar configuración"}
      </Button>
    </form>
  );
}
