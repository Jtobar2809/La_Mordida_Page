"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  upsertComponente,
  deleteComponente,
  recalcularCostoElaborado,
  actualizarRendimiento,
} from "@/actions/admin/composicion";
import { UNIDAD_LABEL, formatCosto, porUnidadDeElaborado, redondearCantidad } from "@/lib/costos";
import type { Insumo, InsumoComponente } from "@prisma/client";

type ComponenteConInsumo = InsumoComponente & { insumoBase: Insumo };

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

  const unidad = UNIDAD_LABEL[insumo.unidad] ?? "unidad";
  const rendimiento = insumo.rendimiento > 0 ? insumo.rendimiento : 1;

  // La composición se anota con los pesos reales de la tanda, así que el costo
  // que sale de sumarla es el de la tanda completa. Lo que las recetas usan es
  // el costo de 1 unidad: ese es el que se divide por el rendimiento.
  const costoTanda = componentes.reduce((sum, c) => sum + c.cantidad * c.insumoBase.costoUnitario, 0);
  const costoUnitario = costoTanda / rendimiento;

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

  // Editar la cantidad de un componente ya guardado: se pesan tandas distintas
  // cada vez y antes tocaba quitar la fila y volver a agregarla.
  const handleUpdateCantidad = async (componente: ComponenteConInsumo, nuevaCantidad: number) => {
    if (!nuevaCantidad || nuevaCantidad <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      router.refresh();
      return;
    }
    if (nuevaCantidad === componente.cantidad) return;

    const result = await upsertComponente({
      id: componente.id,
      insumoElaboradoId: insumo.id,
      insumoBaseId: componente.insumoBaseId,
      cantidad: nuevaCantidad,
    });
    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Cantidad actualizada");
    router.refresh();
  };

  const handleUpdateRendimiento = async (nuevo: number) => {
    if (!nuevo || nuevo <= 0) {
      toast.error("El rendimiento debe ser mayor a 0");
      router.refresh();
      return;
    }
    if (nuevo === insumo.rendimiento) return;

    const result = await actualizarRendimiento({ insumoId: insumo.id, rendimiento: nuevo });
    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Rendimiento actualizado");
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
      <div className="rounded-xl border border-charcoal-200 p-3 dark:border-charcoal-600">
        <label htmlFor="rendimiento" className="block text-sm font-medium text-charcoal-700 dark:text-cream">
          ¿Cuánto rinde una tanda?
        </label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            id="rendimiento"
            key={`rendimiento-${insumo.rendimiento}`}
            type="number"
            step="any"
            min={0}
            defaultValue={insumo.rendimiento}
            onBlur={(e) => handleUpdateRendimiento(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="w-32"
          />
          <span className="text-sm text-charcoal-400">{unidad}</span>
        </div>
        <p className="mt-2 text-xs text-charcoal-400">
          Anota abajo los pesos reales que usas en la preparación (los que pones en la balanza) y aquí cuánto sale de esa
          tanda. Con eso el sistema calcula solo cuánto vale 1 {unidad} de {insumo.nombre}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-3 py-2">Insumo base</th>
              <th className="px-3 py-2">Cantidad por tanda</th>
              <th className="px-3 py-2">Por 1 {unidad}</th>
              <th className="px-3 py-2">Costo en la tanda</th>
              <th className="px-3 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {componentes.map((c) => (
              <tr key={c.id} className="bg-white dark:bg-charcoal-800">
                <td className="px-3 py-2 font-medium text-charcoal-900 dark:text-cream">{c.insumoBase.nombre}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      key={`${c.id}-${c.cantidad}`}
                      type="number"
                      step="any"
                      min={0}
                      defaultValue={c.cantidad}
                      onBlur={(e) => handleUpdateCantidad(c, Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-24 rounded-lg border border-charcoal-200 bg-transparent px-2 py-1 text-sm focus:border-ember-500 focus:outline-none dark:border-charcoal-600 dark:text-cream"
                    />
                    <span className="text-xs text-charcoal-400">{UNIDAD_LABEL[c.insumoBase.unidad]}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-charcoal-400">
                  {redondearCantidad(porUnidadDeElaborado(c.cantidad, rendimiento))} {UNIDAD_LABEL[c.insumoBase.unidad]}
                </td>
                <td className="px-3 py-2">{formatCosto(c.cantidad * c.insumoBase.costoUnitario)}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="icon" variant="ghost" onClick={() => handleRemove(c.id)} aria-label="Quitar">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
            {componentes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-charcoal-400">
                  Sin componentes todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-charcoal-400">
        Un componente puede ser a su vez otro insumo elaborado (ej. una salsa dentro de un combo). En ese caso el costo que se
        muestra es un estimado con su último costo guardado — al presionar «Usar como costo del insumo» se recalcula en
        cascada, sin importar el orden.
      </p>

      {opciones.length > 0 ? (
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-charcoal-200 p-3 dark:border-charcoal-600">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs text-charcoal-400">Insumo base</label>
            <Select value={insumoBaseId} onChange={(e) => setInsumoBaseId(e.target.value)}>
              {opciones.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre} ({UNIDAD_LABEL[i.unidad]}
                  {i.esElaborado ? " · elaborado" : ""})
                </option>
              ))}
            </Select>
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs text-charcoal-400">Cantidad por tanda</label>
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
          <p className="text-sm text-charcoal-400">
            Costo de la tanda ({redondearCantidad(rendimiento)} {unidad})
          </p>
          <p className="font-display text-lg text-charcoal-900 dark:text-cream">{formatCosto(costoTanda)}</p>
          <p className="mt-1 text-xs text-charcoal-400">
            = {formatCosto(costoUnitario)} por {unidad}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={handleRecalcular}>
          <Calculator className="h-4 w-4" /> Usar como costo del insumo
        </Button>
      </div>
    </div>
  );
}
