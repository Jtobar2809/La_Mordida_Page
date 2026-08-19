import Link from "next/link";
import { InventarioTabs } from "@/components/admin/inventario-tabs";
import { obtenerPerdidas } from "@/lib/inventario";
import { formatCosto } from "@/lib/costos";

export const dynamic = "force-dynamic";

const RANGOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
  { dias: 0, label: "Todo" },
];

export default async function AdminMermasPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams;
  const dias = Number(diasParam ?? 30);
  const desde = dias > 0 ? new Date(Date.now() - dias * 24 * 60 * 60 * 1000) : undefined;

  const { movimientos, total: totalPerdida, topInsumos, costoDe } = await obtenerPerdidas(desde);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">INVENTARIO · MERMAS Y PÉRDIDAS</h1>
        <InventarioTabs />
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {RANGOS.map((r) => (
          <Link
            key={r.dias}
            href={`/admin/inventario/mermas?dias=${r.dias}`}
            className={
              dias === r.dias
                ? "rounded-full bg-charcoal-800 px-3 py-1.5 font-medium text-white dark:bg-cream dark:text-charcoal-900"
                : "rounded-full px-3 py-1.5 font-medium text-charcoal-500 hover:bg-charcoal-100 dark:text-charcoal-300 dark:hover:bg-charcoal-700/50"
            }
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300">Pérdida estimada</p>
          <p className="mt-1 font-display text-2xl text-red-700 dark:text-red-300">{formatCosto(totalPerdida)}</p>
        </div>
        <div className="rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
          <p className="text-xs uppercase tracking-wide text-charcoal-400">Eventos registrados</p>
          <p className="mt-1 font-display text-2xl text-charcoal-900 dark:text-cream">{movimientos.length}</p>
        </div>
        <div className="rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
          <p className="text-xs uppercase tracking-wide text-charcoal-400">Insumo más afectado</p>
          <p className="mt-1 font-display text-lg text-charcoal-900 dark:text-cream">{topInsumos[0]?.nombre ?? "—"}</p>
        </div>
      </div>

      {topInsumos.length > 0 && (
        <div className="mb-6 rounded-2xl border border-charcoal-100 p-4 dark:border-charcoal-700">
          <p className="mb-3 text-sm font-medium text-charcoal-600 dark:text-charcoal-300">Top insumos con más pérdida</p>
          <div className="space-y-2">
            {topInsumos.map((i) => (
              <div key={i.nombre} className="flex items-center justify-between text-sm">
                <span className="text-charcoal-700 dark:text-cream">{i.nombre}</span>
                <span className="font-mono font-semibold text-red-600 dark:text-red-400">{formatCosto(i.costo)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Insumo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Costo estimado</th>
              <th className="px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {movimientos.map((m) => (
              <tr key={m.id} className="bg-white dark:bg-charcoal-800">
                <td className="px-4 py-3 text-charcoal-500 dark:text-charcoal-300">{new Date(m.createdAt).toLocaleDateString("es-CO")}</td>
                <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">{m.insumo.nombre}</td>
                <td className="px-4 py-3 text-charcoal-400">{m.tipo === "MERMA" ? "Merma" : "Ajuste (conteo físico)"}</td>
                <td className="px-4 py-3">
                  {Math.abs(m.cantidad)} {m.insumo.unidad.toLowerCase()}
                </td>
                <td className="px-4 py-3 font-mono text-red-600 dark:text-red-400">{formatCosto(costoDe(m))}</td>
                <td className="px-4 py-3 text-charcoal-400">{m.motivo || "—"}</td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-charcoal-400">
                  Sin mermas ni ajustes negativos en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
