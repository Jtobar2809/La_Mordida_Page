"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PackageMinus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrarConsumoManual } from "@/actions/admin/consumo";
import { UNIDAD_LABEL, formatCosto, redondearCantidad } from "@/lib/costos";
import { formatDateTime } from "@/lib/utils";
import type { Insumo, MovimientoInsumo } from "@prisma/client";

type MovimientoConInsumo = MovimientoInsumo & { insumo: { nombre: string; unidad: string } };

export function ConsumoManager({
  insumos,
  historial,
}: {
  insumos: Insumo[];
  historial: MovimientoConInsumo[];
}) {
  const router = useRouter();
  const [cantidades, setCantidades] = React.useState<Record<string, string>>({});
  const [fecha, setFecha] = React.useState(new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);

  const items = insumos
    .map((i) => ({ insumo: i, cantidad: Number(cantidades[i.id] ?? "") }))
    .filter((x) => x.cantidad > 0);

  const costoTotal = items.reduce((s, x) => s + x.cantidad * x.insumo.costoUnitario, 0);

  const registrar = async () => {
    if (items.length === 0) return toast.error("Escribe al menos una cantidad");

    setGuardando(true);
    const result = await registrarConsumoManual({
      fecha,
      notas: notas.trim() || undefined,
      items: items.map((x) => ({ insumoId: x.insumo.id, cantidad: x.cantidad })),
    });
    setGuardando(false);

    if (!result.success) return toast.error(result.error);
    toast.success(`Descontados ${result.data?.movimientos ?? 0} insumo(s)`);
    setCantidades({});
    setNotas("");
    router.refresh();
  };

  if (insumos.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-charcoal-200 py-16 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
        No tienes insumos marcados como &quot;se descuenta a mano&quot;. Márcalos editando el insumo en la pestaña{" "}
        <Link href="/admin/inventario" className="underline hover:text-ember-500">
          Insumos
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
              <tr>
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3">Quedan</th>
                <th className="px-4 py-3">¿Cuántos gastaste?</th>
                <th className="px-4 py-3">Quedaría</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
              {insumos.map((i) => {
                const escrito = Number(cantidades[i.id] ?? "");
                const usa = escrito > 0;
                const restante = i.stockActual - (usa ? escrito : 0);
                const unidad = UNIDAD_LABEL[i.unidad] ?? i.unidad.toLowerCase();
                const bajo = restante <= i.stockMinimo;

                return (
                  <tr key={i.id} className="bg-white dark:bg-charcoal-800">
                    <td className="px-4 py-2.5 font-medium text-charcoal-900 dark:text-cream">{i.nombre}</td>
                    <td className="px-4 py-2.5 font-mono text-charcoal-400">
                      {redondearCantidad(i.stockActual)} {unidad}
                    </td>
                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={cantidades[i.id] ?? ""}
                        onChange={(e) => setCantidades((p) => ({ ...p, [i.id]: e.target.value }))}
                        placeholder="—"
                        className="w-28"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {usa ? (
                        <span
                          className={
                            restante < 0
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : bajo
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-charcoal-500 dark:text-charcoal-300"
                          }
                        >
                          {redondearCantidad(restante)} {unidad}
                          {restante < 0 ? " — no alcanza" : bajo ? " — bajo" : ""}
                        </span>
                      ) : (
                        <span className="text-charcoal-300 dark:text-charcoal-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
          <div className="w-40">
            <Label htmlFor="fechaConsumo">Fecha</Label>
            <Input id="fechaConsumo" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="notasConsumo">Nota (opcional)</Label>
            <Input
              id="notasConsumo"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: domicilios del sábado"
            />
          </div>
          {items.length > 0 && (
            <Button variant="ghost" onClick={() => setCantidades({})}>
              <RotateCcw className="h-4 w-4" /> Limpiar
            </Button>
          )}
          <Button onClick={registrar} disabled={guardando || items.length === 0}>
            <PackageMinus className="h-4 w-4" />
            {guardando ? "Descontando..." : `Descontar ${items.length > 0 ? `(${items.length})` : ""}`}
          </Button>
        </div>

        {items.length > 0 && (
          <p className="text-sm text-charcoal-500 dark:text-charcoal-300">
            Vas a descontar {items.length} insumo(s) por un valor de{" "}
            <strong className="text-charcoal-900 dark:text-cream">{formatCosto(costoTotal)}</strong>. Eso entra como
            costo del período, igual que cualquier insumo consumido.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Últimos descuentos</h2>
        {historial.length === 0 ? (
          <p className="py-10 text-center text-sm text-charcoal-400">Todavía no has descontado desechables.</p>
        ) : (
          <div className="divide-y divide-charcoal-50 dark:divide-charcoal-700/50">
            {historial.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-charcoal-900 dark:text-cream">{m.insumo.nombre}</p>
                  <p className="text-xs text-charcoal-400">{formatDateTime(m.createdAt)}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-charcoal-500 dark:text-charcoal-300">
                  −{redondearCantidad(m.cantidad)} {UNIDAD_LABEL[m.insumo.unidad] ?? ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
