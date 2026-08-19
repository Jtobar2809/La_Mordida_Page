import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCOP, formatDateTime, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCajaSesionesPage() {
  const sesiones = await prisma.cajaSesion.findMany({
    orderBy: { abiertaAt: "desc" },
    take: 60,
    include: {
      abiertaPor: { select: { name: true, email: true } },
      cerradaPor: { select: { name: true, email: true } },
      _count: { select: { ordenes: true } },
    },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">TURNOS DE CAJA</h1>
          <p className="mt-1 text-sm text-charcoal-400">Historial de aperturas, cierres y arqueos.</p>
        </div>
        <Link
          href="/admin/caja"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal-500 transition-colors hover:text-ember-600 dark:text-charcoal-300"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la caja
        </Link>
      </div>

      {sesiones.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-charcoal-200 py-16 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
          Todavía no se ha abierto ninguna caja.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-charcoal-100 text-left text-xs uppercase tracking-wide text-charcoal-400 dark:border-charcoal-700">
              <tr>
                <th className="p-4 font-semibold">Turno</th>
                <th className="p-4 font-semibold">Apertura</th>
                <th className="p-4 font-semibold">Cierre</th>
                <th className="p-4 text-right font-semibold">Ventas</th>
                <th className="p-4 text-right font-semibold">Esperado</th>
                <th className="p-4 text-right font-semibold">Contado</th>
                <th className="p-4 text-right font-semibold">Diferencia</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody>
              {sesiones.map((sesion) => {
                const abierta = sesion.estado === "ABIERTA";
                return (
                  <tr
                    key={sesion.id}
                    className="border-b border-charcoal-50 last:border-0 dark:border-charcoal-700/50"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {abierta && <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-olive-400" />}
                        <span className="font-mono font-semibold text-charcoal-900 dark:text-cream">{sesion.codigo}</span>
                      </div>
                      <span className="text-xs text-charcoal-400">{sesion._count.ordenes} ventas</span>
                    </td>
                    <td className="p-4 text-charcoal-500 dark:text-charcoal-300">
                      {formatDateTime(sesion.abiertaAt)}
                      <span className="block text-xs text-charcoal-400">
                        {sesion.abiertaPor.name ?? sesion.abiertaPor.email ?? "—"}
                      </span>
                    </td>
                    <td className="p-4 text-charcoal-500 dark:text-charcoal-300">
                      {sesion.cerradaAt ? (
                        <>
                          {formatDateTime(sesion.cerradaAt)}
                          <span className="block text-xs text-charcoal-400">
                            {sesion.cerradaPor?.name ?? sesion.cerradaPor?.email ?? "—"}
                          </span>
                        </>
                      ) : (
                        <span className="rounded-full bg-olive-100 px-2.5 py-1 text-xs font-semibold text-olive-700 dark:bg-olive-900/30 dark:text-olive-200">
                          Abierta
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono text-charcoal-900 dark:text-cream">
                      {sesion.totalVentas === null ? "—" : formatCOP(sesion.totalVentas)}
                    </td>
                    <td className="p-4 text-right font-mono text-charcoal-500 dark:text-charcoal-300">
                      {sesion.esperadoEfectivo === null ? "—" : formatCOP(sesion.esperadoEfectivo)}
                    </td>
                    <td className="p-4 text-right font-mono text-charcoal-500 dark:text-charcoal-300">
                      {sesion.efectivoContado === null ? "—" : formatCOP(sesion.efectivoContado)}
                    </td>
                    <td className="p-4 text-right">
                      {sesion.diferencia === null ? (
                        <span className="text-charcoal-300">—</span>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 font-mono text-xs font-bold",
                            sesion.diferencia === 0
                              ? "bg-olive-100 text-olive-700 dark:bg-olive-900/30 dark:text-olive-200"
                              : sesion.diferencia > 0
                                ? "bg-mustard-100 text-mustard-800 dark:bg-mustard-900/30 dark:text-mustard-200"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          )}
                        >
                          {sesion.diferencia > 0 ? "+" : ""}
                          {formatCOP(sesion.diferencia)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/admin/caja/sesiones/${sesion.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-ember-600 hover:underline"
                      >
                        Detalle <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
