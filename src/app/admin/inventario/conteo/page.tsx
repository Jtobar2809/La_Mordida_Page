import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { InventarioTabs } from "@/components/admin/inventario-tabs";
import { NuevoConteoButton } from "@/components/admin/nuevo-conteo-button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { formatCosto } from "@/lib/costos";

export const dynamic = "force-dynamic";

export default async function AdminConteosPage() {
  const conteos = await prisma.conteoInventario.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { items: { select: { stockSistema: true, stockContado: true, costoUnitario: true } } },
  });

  const hayBorrador = conteos.some((c) => c.estado === "BORRADOR");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
          INVENTARIO · CONTEO FÍSICO
        </h1>
        <InventarioTabs />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-charcoal-400">
          Contar lo que de verdad hay en la nevera y compararlo con lo que el sistema cree tener. El stock calculado solo
          baja por ventas y producciones — no captura la porción de más, lo que se dañó ni lo que se botó sin reportar.
          Esta es la única forma de ver ese hueco.
        </p>
        <NuevoConteoButton hayBorrador={hayBorrador} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Contados</th>
              <th className="px-4 py-3">Diferencia neta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {conteos.map((c) => {
              const contados = c.items.filter((i) => i.stockContado !== null);
              const neto = contados.reduce(
                (s, i) => s + ((i.stockContado as number) - i.stockSistema) * i.costoUnitario,
                0
              );
              return (
                <tr key={c.id} className="bg-white hover:bg-charcoal-50/60 dark:bg-charcoal-800 dark:hover:bg-charcoal-700/40">
                  <td className="px-4 py-3 font-mono font-medium text-charcoal-900 dark:text-cream">
                    <Link href={`/admin/inventario/conteo/${c.id}`} className="hover:text-ember-500">
                      {c.codigo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-charcoal-400">{formatDateTime(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    {c.estado === "APLICADO" ? (
                      <Badge variant="olive">Aplicado</Badge>
                    ) : (
                      <Badge variant="outline">En curso</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-charcoal-400">
                    {contados.length} de {c.items.length}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {contados.length === 0 ? (
                      <span className="text-charcoal-300 dark:text-charcoal-600">—</span>
                    ) : (
                      <span className={neto < 0 ? "text-red-600 dark:text-red-400" : "text-charcoal-500 dark:text-charcoal-300"}>
                        {neto < 0 ? "−" : "+"}
                        {formatCosto(Math.abs(neto))}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {conteos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-charcoal-400">
                  <ClipboardList className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  Todavía no has hecho ninguna toma de inventario.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
