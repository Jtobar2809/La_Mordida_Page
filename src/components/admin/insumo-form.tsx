"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { upsertInsumo } from "@/actions/admin/insumos";
import { UNIDAD_LABEL, costoPorUnidad, formatCosto } from "@/lib/costos";
import type { Insumo, Proveedor } from "@prisma/client";

const UNIDADES = [
  { value: "UNIDAD", label: "Unidad (porción, pieza)" },
  { value: "GRAMOS", label: "Gramos (g)" },
  { value: "KILOGRAMOS", label: "Kilogramos (kg)" },
  { value: "MILILITROS", label: "Mililitros (ml)" },
  { value: "LITROS", label: "Litros (l)" },
];

export function InsumoForm({
  insumo,
  proveedores,
  onDone,
}: {
  insumo: (Insumo & { proveedorPrincipal?: { nombre: string } | null }) | null;
  proveedores: Proveedor[];
  onDone: (nuevo?: { id: string; nombre: string; unidad: Insumo["unidad"]; stockActual: number }) => void;
}) {
  const [form, setForm] = React.useState({
    nombre: insumo?.nombre ?? "",
    unidad: insumo?.unidad ?? "UNIDAD",
    stockMinimo: insumo?.stockMinimo ?? 0,
    // El precio se escribe como se compra ("$25.000 por 3.000 g") y el costo por
    // unidad lo saca el sistema. Antes había que teclear el costo de un solo
    // gramo, que casi nunca es un número redondo.
    precioReferencia: insumo?.precioReferencia ?? 0,
    cantidadReferencia: insumo?.cantidadReferencia ?? 1,
    proveedor: insumo?.proveedor ?? "",
    proveedorPrincipalId: insumo?.proveedorPrincipalId ?? "",
    fechaVencimiento: insumo?.fechaVencimiento ? new Date(insumo.fechaVencimiento).toISOString().slice(0, 10) : "",
    esElaborado: insumo?.esElaborado ?? false,
    consumoManual: insumo?.consumoManual ?? false,
    activo: insumo?.activo ?? true,
  });
  const [loading, setLoading] = React.useState(false);

  const unidadCorta = UNIDAD_LABEL[form.unidad] ?? "unidad";
  const costoCalculado = costoPorUnidad(form.precioReferencia, form.cantidadReferencia);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertInsumo({ id: insumo?.id, ...form });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success(insumo ? "Insumo actualizado" : "Insumo creado");

    // Si es uno nuevo, avisamos al padre con lo justo para que pueda abrir
    // de una vez el registro de stock inicial — sin esto, el insumo quedaba
    // en 0 y nadie sabía que había un paso más para cargar cuánto hay.
    if (!insumo && result.data) {
      onDone({ id: result.data.id, nombre: form.nombre, unidad: form.unidad as Insumo["unidad"], stockActual: 0 });
    } else {
      onDone();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nombre">Nombre del insumo</Label>
        <Input id="nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Carne artesanal" />
      </div>
      <div>
        <Label htmlFor="unidad">Unidad de medida</Label>
        <Select id="unidad" value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value as Insumo["unidad"] })}>
          {UNIDADES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="stockMinimo">Stock mínimo (alerta)</Label>
        <Input
          id="stockMinimo"
          type="number"
          step="any"
          min={0}
          value={form.stockMinimo}
          onChange={(e) => setForm({ ...form, stockMinimo: Number(e.target.value) })}
        />
      </div>

      <div className="rounded-xl border border-charcoal-200 p-3 dark:border-charcoal-600">
        <Label htmlFor="precioReferencia">Precio — tal como lo compras</Label>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <div className="min-w-[110px] flex-1">
            <span className="mb-1 block text-xs text-charcoal-400">Pagas (COP)</span>
            <Input
              id="precioReferencia"
              type="number"
              step="any"
              min={0}
              value={form.precioReferencia}
              onChange={(e) => setForm({ ...form, precioReferencia: Number(e.target.value) })}
              placeholder="Ej: 25000"
            />
          </div>
          <span className="pb-2 text-sm text-charcoal-400">por</span>
          <div className="min-w-[110px] flex-1">
            <span className="mb-1 block text-xs text-charcoal-400">Cantidad ({unidadCorta})</span>
            <Input
              id="cantidadReferencia"
              type="number"
              step="any"
              min={0}
              value={form.cantidadReferencia}
              onChange={(e) => setForm({ ...form, cantidadReferencia: Number(e.target.value) })}
              placeholder="Ej: 3000"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-charcoal-400">
          Costo por {unidadCorta}:{" "}
          <strong className="text-charcoal-700 dark:text-cream">{formatCosto(costoCalculado)}</strong> — se calcula solo, y es
          el que suman las recetas según la cantidad que lleve cada una.
        </p>
        {form.esElaborado && (
          <p className="mt-1 text-xs text-charcoal-400">
            Como es elaborado, este precio se sobrescribe cuando presionas «Usar como costo del insumo» en su composición.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="fechaVencimiento">Próxima fecha de vencimiento (opcional)</Label>
        <Input
          id="fechaVencimiento"
          type="date"
          value={form.fechaVencimiento}
          onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })}
        />
        <p className="mt-1 text-xs text-charcoal-400">La actualizas tú manualmente cuando recibas o revises el insumo — no se calcula sola por lote.</p>
      </div>
      <div>
        <Label htmlFor="proveedorPrincipalId">Proveedor principal</Label>
        <Select
          id="proveedorPrincipalId"
          value={form.proveedorPrincipalId}
          onChange={(e) => setForm({ ...form, proveedorPrincipalId: e.target.value })}
        >
          <option value="">Sin proveedor asignado</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
        {proveedores.length === 0 && (
          <p className="mt-1 text-xs text-charcoal-400">Aún no tienes proveedores creados — puedes hacerlo desde la pestaña &quot;Proveedores&quot;.</p>
        )}
      </div>
      <div>
        <Label htmlFor="proveedor">Notas de proveedor (opcional)</Label>
        <Input id="proveedor" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} placeholder="Ej: pedir con 2 días de anticipación" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.esElaborado}
          onChange={(e) => setForm({ ...form, esElaborado: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-ember-600"
        />
        <span>
          Es un insumo elaborado (se prepara combinando otros insumos, ej. salsas o mezclas)
          <span className="block text-xs text-charcoal-400">Podrás definir su composición después de guardar, desde el botón «Composición» en la tabla.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.consumoManual}
          onChange={(e) => setForm({ ...form, consumoManual: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-ember-600"
        />
        <span>
          Se descuenta a mano (bolsas, papel, desechables)
          <span className="block text-xs text-charcoal-400">
            Para lo que no puede ir en una receta porque no depende del plato sino de si el pedido es para llevar. Aparece
            en la pestaña «Desechables» para descontarlo por lote.
          </span>
        </span>
      </label>
      {insumo && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 accent-ember-600" />
          Activo (disponible para usar en recetas)
        </label>
      )}
      {!insumo && <p className="text-xs text-charcoal-400">El stock inicial se registra en el siguiente paso, como un movimiento de entrada, para quedar trazado.</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : insumo ? "Guardar cambios" : "Crear insumo"}
      </Button>
    </form>
  );
}
