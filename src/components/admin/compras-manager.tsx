"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CompraForm } from "@/components/admin/compra-form";
import type { Insumo, Proveedor, Compra, CompraItem } from "@prisma/client";

type CompraConDetalle = Compra & { proveedor: { nombre: string }; items: CompraItem[] };

export function ComprasManager({
  compras,
  proveedores,
  insumos,
}: {
  compras: CompraConDetalle[];
  proveedores: Proveedor[];
  insumos: Insumo[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva compra
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Insumos</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {compras.map((c) => (
              <tr key={c.id} className="bg-white dark:bg-charcoal-800">
                <td className="px-4 py-3 text-charcoal-500 dark:text-charcoal-300">{new Date(c.fecha).toLocaleDateString("es-CO")}</td>
                <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">{c.proveedor.nombre}</td>
                <td className="px-4 py-3 text-charcoal-400">{c.items.length} línea(s)</td>
                <td className="px-4 py-3 font-mono font-semibold">${c.total.toLocaleString("es-CO")}</td>
                <td className="px-4 py-3 text-charcoal-400">{c.notas || "—"}</td>
              </tr>
            ))}
            {compras.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-charcoal-400">
                  Aún no hay compras registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva compra">
        <CompraForm
          proveedores={proveedores}
          insumos={insumos}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
