"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Wallet, Info } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import { construirPuente, type FlujoDelMes, type LineaFlujo } from "@/lib/flujo";
import type { EstadoResultados } from "@/lib/contabilidad";

/**
 * "Entró tanto, salió tanto, quedó tanto" — con las compras adentro.
 *
 * Va ARRIBA del estado de resultados a propósito: es la pregunta que uno trae
 * al abrir la pantalla. La utilidad, que es la que sabe de despensa y de
 * márgenes, explica después por qué esa cifra no es la misma.
 *
 * La paleta es la del estado de resultados, y no por gusto: verde es plata que
 * entra y naranja es plata que sale en las dos pantallas, así que el ojo no
 * tiene que reaprender el código a mitad de página.
 */
const ENTRA = "#12907C";
const SALE = "#E85C2B";

export function FlujoPanel({ flujo, estado }: { flujo: FlujoDelMes; estado: EstadoResultados }) {
  const { entradas, salidas, totalEntradas, totalSalidas, neto } = flujo;

  const puente = React.useMemo(() => construirPuente(flujo, estado), [flujo, estado]);
  const quedaEnNegocio = estado.utilidadNeta - estado.retiroReal;

  if (totalEntradas === 0 && totalSalidas === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-200 p-10 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
        Este mes no tiene plata registrada: ni entradas ni salidas.
      </div>
    );
  }

  const sobra = neto >= 0;

  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">
            <Wallet className="h-4 w-4 text-ember-500" /> FLUJO DEL MES
          </h2>
          <p className="mt-0.5 text-xs text-charcoal-400">
            Toda la plata que entró y toda la que salió, compras incluidas. Una sola bolsa.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-charcoal-400">
            {sobra ? "Quedó este mes" : "Faltó este mes"}
          </p>
          <p className="font-display text-4xl" style={{ color: sobra ? ENTRA : SALE }}>
            {formatCOP(neto)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Columna
          titulo="Entró"
          icono={<ArrowUpRight className="h-4 w-4" />}
          color={ENTRA}
          total={totalEntradas}
          lineas={entradas}
          vacio="No entró plata este mes."
        />
        <Columna
          titulo="Salió"
          icono={<ArrowDownRight className="h-4 w-4" />}
          color={SALE}
          total={totalSalidas}
          lineas={salidas}
          vacio="No salió plata este mes."
        />
      </div>

      {flujo.fijos > 0 && (
        // La única cifra del panel que no sale de un movimiento registrado: los
        // fijos son el compromiso del mes, no un pago anotado uno por uno. Se
        // dice acá porque quien anote además el arriendo como gasto suelto lo
        // va a ver contado dos veces, y tiene que saber por qué.
        <p className="mt-4 rounded-xl bg-charcoal-50 px-3 py-2 text-xs text-charcoal-500 dark:bg-charcoal-900/40 dark:text-charcoal-300">
          Los <strong>{formatCOP(flujo.fijos)}</strong> de costos fijos entran completos aunque el mes vaya en curso: el
          arriendo se paga entero. Van desde la tabla de costos fijos, así que no los anotes también como gasto suelto o
          se cuentan dos veces.
        </p>
      )}

      {puente.length > 0 && (
        <div className="mt-4 rounded-xl border border-charcoal-100 p-4 dark:border-charcoal-700">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-charcoal-400">
            <Info className="h-3.5 w-3.5" /> Por qué no es lo mismo que la utilidad
          </p>

          <dl className="mt-3 space-y-1.5 text-sm">
            <Renglon
              etiqueta="Lo que quedó según la utilidad"
              monto={quedaEnNegocio}
              detalle="Utilidad neta menos lo que sacaron los socios."
              sinSigno
            />
            {puente.map((l) => (
              <Renglon key={l.etiqueta} etiqueta={l.etiqueta} monto={l.monto} detalle={l.detalle} />
            ))}
            <div className="!mt-3 flex items-baseline justify-between border-t border-charcoal-100 pt-2 dark:border-charcoal-700">
              <dt className="text-sm font-medium text-charcoal-900 dark:text-cream">La plata que quedó</dt>
              <dd className="font-mono text-sm font-bold" style={{ color: sobra ? ENTRA : SALE }}>
                {formatCOP(neto)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function Columna({
  titulo,
  icono,
  color,
  total,
  lineas,
  vacio,
}: {
  titulo: string;
  icono: React.ReactNode;
  color: string;
  total: number;
  lineas: LineaFlujo[];
  vacio: string;
}) {
  return (
    <div className="rounded-xl border border-charcoal-100 p-4 dark:border-charcoal-700">
      <div className="flex items-baseline justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide" style={{ color }}>
          {icono} {titulo}
        </p>
        <p className="font-mono text-xl font-bold" style={{ color }}>
          {formatCOP(total)}
        </p>
      </div>

      {lineas.length === 0 ? (
        <p className="mt-3 text-xs text-charcoal-400">{vacio}</p>
      ) : (
        <dl className="mt-3 space-y-2">
          {lineas.map((l) => (
            <div key={l.etiqueta}>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-charcoal-700 dark:text-cream">{l.etiqueta}</dt>
                <dd className="font-mono text-sm text-charcoal-900 dark:text-cream">{formatCOP(l.monto)}</dd>
              </div>
              {l.nota && <p className="mt-0.5 text-xs text-charcoal-400">{l.nota}</p>}
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Un renglón del puente. El signo se pinta, no se deduce al leer. */
function Renglon({
  etiqueta,
  monto,
  detalle,
  sinSigno,
}: {
  etiqueta: string;
  monto: number;
  detalle: string;
  sinSigno?: boolean;
}) {
  const suma = monto >= 0;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <dt className="text-sm text-charcoal-700 dark:text-cream">{etiqueta}</dt>
        <p className="text-xs text-charcoal-400">{detalle}</p>
      </div>
      <dd
        className="shrink-0 font-mono text-sm"
        style={sinSigno ? undefined : { color: suma ? ENTRA : SALE }}
      >
        {sinSigno ? "" : suma ? "+ " : "− "}
        {formatCOP(sinSigno ? monto : Math.abs(monto))}
      </dd>
    </div>
  );
}
