"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { registrarMovimiento } from "@/actions/admin/insumos";
import type { Insumo } from "@prisma/client";

const TIPOS = [
  { value: "ENTRADA", label: "Entrada (compra o recepción)" },
  { value: "SALIDA", label: "Salida manual (uso en cocina)" },
  { value: "MERMA", label: "Merma / pérdida" },
  { value: "AJUSTE", label: "Ajuste de conteo físico" },
];

export function MovimientoForm({ insumo, onDone }: { insumo: Insumo; onDone: () => void }) {
  const [tipo, setTipo] = React.useState<"ENTRADA" | "SALIDA" | "MERMA" | "AJUSTE">("ENTRADA");
  const [cantidad, setCantidad] = React.useState(0);
  const [motivo, setMotivo] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await registrarMovimiento({ insumoId: insumo.id, tipo, cantidad, motivo: motivo || undefined });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success("Movimiento registrado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-charcoal-400">
        Stock actual: <strong className="text-charcoal-800 dark:text-cream">{insumo.stockActual} {insumo.unidad.toLowerCase()}</strong>
      </p>
      <div>
        <Label htmlFor="tipo">Tipo de movimiento</Label>
        <Select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="cantidad">{tipo === "AJUSTE" ? "Cantidad (usa negativo para restar)" : "Cantidad"}</Label>
        <Input id="cantidad" type="number" step="any" required value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
      </div>
      <div>
        <Label htmlFor="motivo">Motivo / referencia (recomendado)</Label>
        <Textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: Compra a Carnes del Cauca, factura #123" rows={2} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : "Registrar movimiento"}
      </Button>
    </form>
  );
}
