"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ArrowUpDown, TriangleAlert, CalendarClock, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { InsumoForm } from "@/components/admin/insumo-form";
import { MovimientoForm } from "@/components/admin/movimiento-form";
import { ComposicionManager } from "@/components/admin/composicion-manager";
import { deleteInsumo } from "@/actions/admin/insumos";
import type { Insumo, Proveedor, InsumoComponente } from "@prisma/client";

type InsumoConProveedor = Insumo & {
  proveedorPrincipal: { nombre: string } | null;
  composicion: (InsumoComponente & { insumoBase: Insumo })[];
};

const UNIDAD_LABEL: Record<string, string> = {
  GRAMOS: "g",
  KILOGRAMOS: "kg",
  MILILITROS: "ml",
  LITROS: "l",
  UNIDAD: "unidad",
};

export function InsumosManager({ insumos, proveedores }: { insumos: InsumoConProveedor[]; proveedores: Proveedor[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<InsumoConProveedor | null | undefined>(undefined);
  const [movingStock, setMovingStock] = React.useState<InsumoConProveedor | null>(null);
  const [composingFor, setComposingFor] = React.useState<InsumoConProveedor | null>(null);

  const bajoStock = insumos.filter((i) => i.activo && i.stockActual <= i.stockMinimo);
  const enTres = Date.now() + 3 * 24 * 60 * 60 * 1000;
  const porVencer = insumos.filter((i) => i.activo && i.stockActual > 0 && i.fechaVencimiento && new Date(i.fechaVencimiento).getTime() <= enTres);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el insumo "${nombre}"?`)) return;
    const result = await deleteInsumo(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Insumo eliminado");
    router.refresh();
  };

  return (
    <div>
      {bajoStock.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>{bajoStock.length}</strong> insumo(s) en o por debajo del stock mínimo: {bajoStock.map((i) => i.nombre).join(", ")}.
          </p>
        </div>
      )}

      {porVencer.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-900 dark:border-orange-700 dark:bg-orange-900/20 dark:text-orange-200">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>{porVencer.length}</strong> insumo(s) por vencer en los próximos 3 días: {porVencer.map((i) => i.nombre).join(", ")}.
          </p>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nuevo insumo
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-4 py-3">Insumo</th>
              <th className="px-4 py-3">Stock actual</th>
              <th className="px-4 py-3">Stock mínimo</th>
              <th className="px-4 py-3">Costo unitario</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {insumos.map((insumo) => {
              const bajo = insumo.stockActual <= insumo.stockMinimo;
              return (
                <tr key={insumo.id} className="bg-white dark:bg-charcoal-800">
                  <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">{insumo.nombre}</td>
                  <td className={`px-4 py-3 ${bajo ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>
                    {insumo.stockActual} {UNIDAD_LABEL[insumo.unidad]}
                  </td>
                  <td className="px-4 py-3 text-charcoal-400">
                    {insumo.stockMinimo} {UNIDAD_LABEL[insumo.unidad]}
                  </td>
                  <td className="px-4 py-3">${insumo.costoUnitario.toLocaleString("es-CO")}</td>
                  <td className="px-4 py-3 text-charcoal-400">{insumo.proveedorPrincipal?.nombre ?? insumo.proveedor ?? "—"}</td>
                  <td className="px-4 py-3">
                    {!insumo.activo ? (
                      <Badge variant="charcoal">Inactivo</Badge>
                    ) : bajo ? (
                      <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400">
                        Stock bajo
                      </Badge>
                    ) : (
                      <Badge variant="olive">OK</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {insumo.esElaborado && (
                        <Button size="icon" variant="ghost" onClick={() => setComposingFor(insumo)} aria-label="Composición">
                          <FlaskConical className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setMovingStock(insumo)} aria-label="Registrar movimiento">
                        <ArrowUpDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(insumo)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(insumo.id, insumo.nombre)} aria-label="Eliminar">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {insumos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-charcoal-400">
                  Aún no hay insumos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "Editar insumo" : "Nuevo insumo"}>
        <InsumoForm
          insumo={editing ?? null}
          proveedores={proveedores}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>

      <Modal open={movingStock !== null} onClose={() => setMovingStock(null)} title={`Movimiento de stock — ${movingStock?.nombre ?? ""}`}>
        {movingStock && (
          <MovimientoForm
            insumo={movingStock}
            onDone={() => {
              setMovingStock(null);
              router.refresh();
            }}
          />
        )}
      </Modal>

      <Modal open={composingFor !== null} onClose={() => setComposingFor(null)} title={`Composición — ${composingFor?.nombre ?? ""}`}>
        {composingFor && (
          <ComposicionManager
            insumo={composingFor}
            componentes={composingFor.composicion}
            insumosDisponibles={insumos.filter((i) => i.id !== composingFor.id && !i.esElaborado)}
            onDone={() => setComposingFor(null)}
          />
        )}
      </Modal>
    </div>
  );
}
