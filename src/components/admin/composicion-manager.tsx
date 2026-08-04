"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { upsertComponente, deleteComponente, recalcularCostoElaborado } from "@/actions/admin/composicion";
import type { Insumo, InsumoComponente } from "@prisma/client";

type ComponenteConInsumo = InsumoComponente & { insumoBase: Insumo };

const UNIDAD_LABEL: Record<string, string> = {
  GRAMOS: "g",
  KILOGRAMOS: "kg",
  MILILITROS: "ml",
  LITROS: "l",
  UNIDAD: "unidad",
};

export function ComposicionManager({
  insumo,
  componentes,
  insumosDisponibles,
  onDone,
}: {
  insumo: Insumo;
  componentes: ComponenteConInsumo[];
  insumosDisponibles: Insumo[];
  onDone: () => void;
}) {
  const router = useRouter();
  const opciones = insumosDisponibles.filter((i) => !componentes.some((c) => c.insumoBaseId === i.id));
  const [insumoBaseId, setInsumoBaseId] = React.useState(opciones[0]?.id ?? "");
  const [cantidad, setCantidad] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  const costoTotal = componentes.reduce((sum, c) => sum + c.cantidad * c.insumoBase.costoUnitario, 0);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insumoBaseId) return toast.error("Elige un insumo");
    setLoading(true);
    const result = await upsertComponente({ insumoElaboradoId: insumo.id, insumoBaseId, cantidad });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Componente agregado");
    setCantidad(1);
    router.refresh();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("¿Quitar este componente?")) return;
    const result = await deleteComponente(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Componente quitado");
    router.refresh();
  };

  const handleRecalcular = async () => {
    const result = await recalcularCostoElaborado(insumo.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Costo del insumo actualizado desde la composición");
    router.refresh();
    onDone();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-charcoal-400">
        Cantidad de cada insumo base por cada <strong className="text-charcoal-700 dark:text-cream">1 {insumo.unidad.toLowerCase()}</strong> de{" "}
        {insumo.nombre}.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-3 py-2">Insumo base</th>
              <th className="px-3 py-2">Cantidad</th>
              <th className="px-3 py-2">Costo parcial</th>
              <th className="px-3 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {componentes.map((c) => (
              <tr key={c.id} className="bg-white dark:bg-charcoal-800">
                <td className="px-3 py-2 font-medium text-charcoal-900 dark:text-cream">{c.insumoBase.nombre}</td>
                <td className="px-3 py-2">
                  {c.cantidad} {UNIDAD_LABEL[c.insumoBase.unidad]}
                </td>
                <td className="px-3 py-2">${(c.cantidad * c.insumoBase.costoUnitario).toLocaleString("es-CO")}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => handleRemove(c.id)} aria-label="Quitar">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
            {componentes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-charcoal-400">
                  Sin componentes todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {opciones.length > 0 ? (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-charcoal-200 p-3 dark:border-charcoal-600">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-charcoal-400">Insumo base</label>
            <Select value={insumoBaseId} onChange={(e) => setInsumoBaseId(e.target.value)}>
              {opciones.map((i) => (
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
        <p className="text-sm text-charcoal-400">Todos los insumos base disponibles ya están en esta composición.</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-charcoal-50 px-4 py-3 dark:bg-charcoal-900/40">
        <div>
          <p className="text-sm text-charcoal-400">Costo calculado por {insumo.unidad.toLowerCase()}</p>
          <p className="font-display text-lg text-charcoal-900 dark:text-cream">${costoTotal.toLocaleString("es-CO")}</p>
        </div>
        <Button type="button" variant="secondary" onClick={handleRecalcular}>
          <Calculator className="h-4 w-4" /> Usar como costo del insumo
        </Button>
      </div>
    </div>
  );
}
