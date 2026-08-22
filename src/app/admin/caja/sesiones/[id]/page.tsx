import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, HandCoins, Receipt } from "lucide-react";
import { obtenerSesionCaja } from "@/lib/caja";
import { ETIQUETA_METODO } from "@/types/caja";
import { formatCOP, formatDateTime, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCajaSesionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await obtenerSesionCaja(id);
  if (!sesion) notFound();

  const { resumen } = sesion;
  const abierta = sesion.estado === "ABIERTA";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
            TURNO {sesion.codigo}
          </h1>
          <p className="mt-1 text-sm text-charcoal-400">
            Abierta {formatDateTime(sesion.abiertaAt)} por {sesion.abiertaPor.name ?? sesion.abiertaPor.email ?? "—"}
            {sesion.cerradaAt
              ? ` · cerrada ${formatDateTime(sesion.cerradaAt)} por ${sesion.cerradaPor?.name ?? sesion.cerradaPor?.email ?? "—"}`
              : " · sigue abierta"}
          </p>
        </div>
        <Link
          href="/admin/caja/sesiones"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal-500 transition-colors hover:text-ember-600 dark:text-charcoal-300"
        >
          <ArrowLeft className="h-4 w-4" /> Todos los turnos
        </Link>
      </div>

      {/* ── Arqueo ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 rounded-2xl border border-charcoal-100 bg-white p-5 text-sm dark:border-charcoal-700 dark:bg-charcoal-800 lg:col-span-2">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Arqueo del efectivo</h2>
          <Fila etiqueta="Base de apertura" valor={sesion.montoInicial} />
          <Fila etiqueta="Ventas en efectivo" valor={resumen.totalEfectivo} />
          <Fila etiqueta="Otros ingresos" valor={resumen.totalIngresos} />
          <Fila etiqueta="Egresos y devoluciones" valor={-resumen.totalEgresos} />
          {resumen.totalRetiros > 0 && <Fila etiqueta="Retiro de socios" valor={-resumen.totalRetiros} />}
          <div className="!mt-3 border-t border-charcoal-100 pt-3 dark:border-charcoal-700">
            <Fila etiqueta="Esperado en el cajón" valor={resumen.esperadoEfectivo} fuerte />
            {sesion.efectivoContado !== null && <Fila etiqueta="Contado al cerrar" valor={sesion.efectivoContado} fuerte />}
          </div>

          {sesion.diferencia !== null && (
            <div
              className={cn(
                "!mt-4 rounded-xl p-4",
                sesion.diferencia === 0
                  ? "bg-olive-50 text-olive-700 dark:bg-olive-900/20 dark:text-olive-200"
                  : "bg-ember-50 text-ember-700 dark:bg-ember-900/20 dark:text-ember-300"
              )}
            >
              <p className="font-display text-2xl">
                {sesion.diferencia === 0
                  ? "Cuadró exacto"
                  : sesion.diferencia > 0
                    ? `Sobrante de ${formatCOP(sesion.diferencia)}`
                    : `Faltante de ${formatCOP(Math.abs(sesion.diferencia))}`}
              </p>
              {sesion.notasCierre && <p className="mt-1 text-sm opacity-80">{sesion.notasCierre}</p>}
            </div>
          )}

          {abierta && (
            <p className="!mt-4 rounded-xl bg-mustard-50 p-3 text-xs text-mustard-800 dark:bg-mustard-900/20 dark:text-mustard-200">
              Este turno sigue abierto, así que los totales se recalculan en vivo. Al cerrarlo quedan congelados.
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-charcoal-100 bg-white p-5 text-sm dark:border-charcoal-700 dark:bg-charcoal-800">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Ventas del turno</h2>
          <Fila etiqueta={`Total vendido (${resumen.cantidadVentas})`} valor={resumen.totalVentas} fuerte />
          <Fila etiqueta="Efectivo" valor={resumen.totalEfectivo} />
          <Fila etiqueta="Nequi" valor={resumen.totalNequi} />
          {resumen.totalOtros > 0 && <Fila etiqueta="Otros medios" valor={resumen.totalOtros} />}
          {sesion.notasApertura && (
            <p className="!mt-4 border-t border-charcoal-100 pt-3 text-xs text-charcoal-400 dark:border-charcoal-700">
              Nota de apertura: {sesion.notasApertura}
            </p>
          )}
        </div>
      </div>

      {/* ── Movimientos ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
          Movimientos ({sesion.movimientos.length})
        </h2>

        {sesion.movimientos.length === 0 ? (
          <p className="py-8 text-center text-sm text-charcoal-400">No hubo movimientos en este turno.</p>
        ) : (
          <div className="divide-y divide-charcoal-50 dark:divide-charcoal-700/50">
            {sesion.movimientos.map((movimiento) => {
              const esRetiro = movimiento.tipo === "RETIRO";
              const esSalida = movimiento.tipo === "EGRESO" || esRetiro;
              const Icono = movimiento.tipo === "VENTA" ? Receipt : esRetiro ? HandCoins : esSalida ? ArrowUpRight : ArrowDownLeft;
              return (
                <div key={movimiento.id} className="flex items-center gap-3 py-3 text-sm">
                  <Icono
                    className={cn(
                      "h-4 w-4 shrink-0",
                      movimiento.tipo === "VENTA"
                        ? "text-charcoal-400"
                        : esRetiro
                          ? "text-mustard-500"
                          : esSalida
                            ? "text-ember-500"
                            : "text-olive-500"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-charcoal-800 dark:text-cream">{movimiento.concepto}</p>
                    <p className="text-xs text-charcoal-400">
                      {formatDateTime(movimiento.createdAt)} · {ETIQUETA_METODO[movimiento.metodo]}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-mono font-semibold",
                      esSalida ? "text-ember-600" : "text-charcoal-900 dark:text-cream"
                    )}
                  >
                    {esSalida ? "−" : "+"}
                    {formatCOP(movimiento.monto)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor, fuerte }: { etiqueta: string; valor: number; fuerte?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-charcoal-500 dark:text-charcoal-300">{etiqueta}</span>
      <span
        className={cn(
          "font-mono text-charcoal-900 dark:text-cream",
          fuerte ? "text-base font-bold" : "font-semibold"
        )}
      >
        {formatCOP(valor)}
      </span>
    </div>
  );
}
