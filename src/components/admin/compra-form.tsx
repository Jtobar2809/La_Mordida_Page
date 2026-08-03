"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { registrarCompra } from "@/actions/admin/compras";
import type { Insumo, Proveedor } from "@prisma/client";

type Fila = { insumoId: string; cantidad: number; costoUnitario: number };

const UNIDAD_LABEL: Record<string, string> = {
  GRAMOS: "g",
  KILOGRAMOS: "kg",
  MILILITROS: "ml",
  LITROS: "l",
  UNIDAD: "unidad",
};

export function CompraForm({ proveedores, insumos, onDone }: { proveedores: Proveedor[]; insumos: Insumo[]; onDone: () => void }) {
  const [proveedorId, setProveedorId] = React.useState(proveedores[0]?.id ?? "");
  const [notas, setNotas] = React.useState("");
  const [filas, setFilas] = React.useState<Fila[]>([{ insumoId: insumos[0]?.id ?? "", cantidad: 1, costoUnitario: 0 }]);
  const [loading, setLoading] = React.useState(false);

  const total = filas.reduce((sum, f) => sum + f.cantidad * f.costoUnitario, 0);

  const actualizarFila = (index: number, cambios: Partial<Fila>) => {
    setFilas((prev) => prev.map((f, i) => (i === index ? { ...f, ...cambios } : f)));
  };

  const agregarFila = () => setFilas((prev) => [...prev, { insumoId: insumos[0]?.id ?? "", cantidad: 1, costoUnitario: 0 }]);
  const quitarFila = (index: number) => setFilas((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) return toast.error("Elige un proveedor");
    setLoading(true);
    const result = await registrarCompra({ proveedorId, notas: notas || undefined, items: filas });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Compra registrada — stock y costos actualizados");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="proveedorId">Proveedor</Label>
        <Select id="proveedorId" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Insumos comprados</Label>
        {filas.map((fila, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 rounded-xl border border-charcoal-100 p-3 dark:border-charcoal-600">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-xs text-charcoal-400">Insumo</label>
              <Select value={fila.insumoId} onChange={(e) => actualizarFila(index, { insumoId: e.target.value })}>
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({UNIDAD_LABEL[i.unidad]})
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs text-charcoal-400">Cantidad</label>
              <Input type="number" step="any" min={0} value={fila.cantidad} onChange={(e) => actualizarFila(index, { cantidad: Number(e.target.value) })} />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-charcoal-400">Costo c/u</label>
              <Input type="number" min={0} value={fila.costoUnitario} onChange={(e) => actualizarFila(index, { costoUnitario: Number(e.target.value) })} />
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => quitarFila(index)} disabled={filas.length === 1} aria-label="Quitar fila">
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={agregarFila}>
          <Plus className="h-4 w-4" /> Agregar insumo
        </Button>
      </div>

      <div>
        <Label htmlFor="notas">Notas / factura (opcional)</Label>
        <Textarea id="notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Ej: Factura #045" />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-charcoal-50 px-4 py-3 dark:bg-charcoal-900/40">
        <span className="text-sm text-charcoal-400">Total de la compra</span>
        <span className="font-display text-lg text-charcoal-900 dark:text-cream">${total.toLocaleString("es-CO")}</span>
      </div>

      <Button type="submit" disabled={loading || proveedores.length === 0} className="w-full">
        {loading ? "Registrando..." : "Registrar compra"}
      </Button>
    </form>
  );
}
