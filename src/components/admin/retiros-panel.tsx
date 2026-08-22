import { HandCoins } from "lucide-react";
import { formatCosto } from "@/lib/costos";
import { formatDate, cn } from "@/lib/utils";
import { ETIQUETA_METODO } from "@/types/caja";
import type { CupoRetiros } from "@/lib/retiros";
import type { MetodoPago } from "@prisma/client";

/**
 * El detalle de lo que los socios sacaron en el mes, retiro por retiro.
 *
 * Existe para que la cifra que el estado de resultados resta debajo de la
 * utilidad sea auditable: cada peso apunta a un turno de caja concreto. Sin
 * esta lista, "retiro de socios: $800.000" es un número que hay que creer.
 */
export function RetirosPanel({ cupo }: { cupo: CupoRetiros }) {
  const { presupuesto, hayPresupuesto, retirado, saldo, exceso, usadoPct, movimientos } = cupo;
  const pasado = exceso > 0;

  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">
            <HandCoins className="h-4 w-4 text-mustard-500" /> RETIRO DE SOCIOS
          </h2>
          <p className="mt-0.5 text-xs text-charcoal-400">
            No es un gasto del negocio: es la ganancia repartida. Por eso va debajo de la utilidad, no restando antes.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl font-bold text-charcoal-900 dark:text-cream">{formatCosto(retirado)}</p>
          {hayPresupuesto && (
            <p className={cn("text-xs", pasado ? "font-semibold text-red-600" : "text-charcoal-400")}>
              {pasado
                ? `${formatCosto(exceso)} por encima del cupo de ${formatCosto(presupuesto)}`
                : `quedan ${formatCosto(saldo)} de ${formatCosto(presupuesto)}`}
            </p>
          )}
        </div>
      </div>

      {hayPresupuesto && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-charcoal-100 dark:bg-charcoal-700">
          <div
            className={cn("h-full rounded-full", pasado ? "bg-red-500" : "bg-ember-500")}
            style={{ width: `${Math.min(usadoPct, 100)}%` }}
          />
        </div>
      )}

      {movimientos.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-charcoal-200 py-6 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
          Este mes todavía no se ha retirado nada desde la caja.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-charcoal-50 dark:divide-charcoal-700/50">
          {movimientos.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-charcoal-800 dark:text-cream">{m.concepto}</p>
                <p className="text-xs text-charcoal-400">
                  {formatDate(m.fecha)} · {ETIQUETA_METODO[m.metodo as MetodoPago] ?? m.metodo} · turno {m.sesionCodigo}
                </p>
              </div>
              <span className="shrink-0 font-mono font-semibold text-charcoal-900 dark:text-cream">
                {formatCosto(m.monto)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
