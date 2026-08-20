"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { upsertGasto, deleteGasto } from "@/actions/admin/gastos";
import { formatCosto } from "@/lib/costos";
import { formatDate } from "@/lib/utils";
import { ETIQUETA_GASTO } from "@/lib/contabilidad";
import type { Gasto, GastoCategoria, MetodoPago } from "@prisma/client";

const CATEGORIAS: GastoCategoria[] = [
  "MANTENIMIENTO",
  "PUBLICIDAD",
  "TRANSPORTE",
  "IMPUESTOS",
  "EQUIPOS",
  "DOMICILIOS",
  "OTRO",
];

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "NEQUI", label: "Nequi" },
  { value: "OTRO", label: "Otro" },
];

export function GastosManager({ gastos }: { gastos: Gasto[] }) {
  const router = useRouter();
  const [editando, setEditando] = React.useState<Gasto | null | undefined>(undefined);

  const total = gastos.reduce((s, g) => s + g.monto, 0);

  const handleDelete = async (gasto: Gasto) => {
    if (!confirm(`¿Eliminar el gasto "${gasto.concepto}"?`)) return;
    const result = await deleteGasto(gasto.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Gasto eliminado");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">GASTOS DEL MES</h2>
          <p className="text-xs text-charcoal-400">
            Lo que no es insumo ni recurrente: reparaciones, publicidad, impuestos, equipos.
          </p>
        </div>
        <Button onClick={() => setEditando(null)}>
          <Plus className="h-4 w-4" /> Registrar gasto
        </Button>
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Las <strong>compras de insumos no van aquí</strong> — esas se registran en Inventario › Compras y entran al
          estado de resultados por lo que se consume, no por lo que se compra. Anotarlas también como gasto las contaría
          dos veces.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Método</th>
              <th className="px-4 py-3">Monto</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {gastos.map((g) => (
              <tr key={g.id} className="bg-white dark:bg-charcoal-800">
                <td className="px-4 py-3 text-charcoal-400">{formatDate(g.fecha)}</td>
                <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">
                  {g.concepto}
                  {g.notas && <span className="block text-xs font-normal text-charcoal-400">{g.notas}</span>}
                </td>
                <td className="px-4 py-3 text-charcoal-400">{ETIQUETA_GASTO[g.categoria] ?? g.categoria}</td>
                <td className="px-4 py-3 text-charcoal-400">{g.metodoPago.toLowerCase()}</td>
                <td className="px-4 py-3 font-mono">{formatCosto(g.monto)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditando(g)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(g)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {gastos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-charcoal-400">
                  Sin gastos registrados en este mes.
                </td>
              </tr>
            )}
          </tbody>
          {gastos.length > 0 && (
            <tfoot className="bg-charcoal-50 dark:bg-charcoal-800">
              <tr>
                <td className="px-4 py-3 font-semibold text-charcoal-900 dark:text-cream" colSpan={4}>
                  Total del mes
                </td>
                <td className="px-4 py-3 font-mono font-bold text-charcoal-900 dark:text-cream">{formatCosto(total)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Modal
        open={editando !== undefined}
        onClose={() => setEditando(undefined)}
        title={editando ? "Editar gasto" : "Registrar gasto"}
      >
        <GastoForm
          gasto={editando ?? null}
          onDone={() => {
            setEditando(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function GastoForm({ gasto, onDone }: { gasto: Gasto | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    fecha: (gasto?.fecha ? new Date(gasto.fecha) : new Date()).toISOString().slice(0, 10),
    concepto: gasto?.concepto ?? "",
    monto: gasto?.monto ?? 0,
    categoria: (gasto?.categoria ?? "OTRO") as GastoCategoria,
    metodoPago: (gasto?.metodoPago ?? "EFECTIVO") as MetodoPago,
    notas: gasto?.notas ?? "",
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertGasto({ id: gasto?.id, ...form });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success(gasto ? "Gasto actualizado" : "Gasto registrado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="concepto">¿De qué fue el gasto?</Label>
        <Input
          id="concepto"
          required
          value={form.concepto}
          onChange={(e) => setForm({ ...form, concepto: e.target.value })}
          placeholder="Ej: Reparación de la freidora"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="monto">Monto (COP)</Label>
          <Input
            id="monto"
            type="number"
            min={0}
            required
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            type="date"
            required
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="categoria">Categoría</Label>
          <Select
            id="categoria"
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value as GastoCategoria })}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_GASTO[c]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="metodoPago">Cómo lo pagaste</Label>
          <Select
            id="metodoPago"
            value={form.metodoPago}
            onChange={(e) => setForm({ ...form, metodoPago: e.target.value as MetodoPago })}
          >
            {METODOS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="notas">Notas (opcional)</Label>
        <Input
          id="notas"
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
          placeholder="Ej: factura #1204"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : gasto ? "Guardar cambios" : "Registrar gasto"}
      </Button>
    </form>
  );
}
