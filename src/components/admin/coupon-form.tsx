"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { upsertCoupon } from "@/actions/admin/coupons";
import type { Coupon } from "@prisma/client";

export function CouponForm({ coupon, onDone }: { coupon: Coupon | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    code: coupon?.code ?? "",
    discountType: coupon?.discountType ?? "PORCENTAJE",
    value: coupon?.value ?? 10,
    minOrder: coupon?.minOrder ?? 0,
    usageLimit: coupon?.usageLimit ?? undefined,
    expiresAt: coupon?.expiresAt ? coupon.expiresAt.toISOString().slice(0, 10) : "",
    active: coupon?.active ?? true,
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertCoupon({ id: coupon?.id, ...form });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success(coupon ? "Cupón actualizado" : "Cupón creado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="code">Código</Label>
        <Input
          id="code"
          required
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="BIENVENIDA10"
          className="font-mono uppercase"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="discountType">Tipo de descuento</Label>
          <Select id="discountType" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as Coupon["discountType"] })}>
            <option value="PORCENTAJE">Porcentaje (%)</option>
            <option value="FIJO">Monto fijo (COP)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="value">Valor</Label>
          <Input id="value" type="number" min={1} required value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="minOrder">Pedido mínimo (COP)</Label>
          <Input id="minOrder" type="number" min={0} value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })} />
        </div>
        <div>
          <Label htmlFor="usageLimit">Límite de usos (opcional)</Label>
          <Input
            id="usageLimit"
            type="number"
            min={1}
            value={form.usageLimit ?? ""}
            onChange={(e) => setForm({ ...form, usageLimit: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="expiresAt">Expira el (opcional)</Label>
        <Input id="expiresAt" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-ember-600" />
        Cupón activo
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : coupon ? "Guardar cambios" : "Crear cupón"}
      </Button>
    </form>
  );
}
