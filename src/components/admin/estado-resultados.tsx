"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { formatCosto } from "@/lib/costos";
import { construirCascada, type TramoCascada, type EstadoResultados } from "@/lib/contabilidad";

/**
 * Paleta validada con scripts/validate_palette.js (skill dataviz).
 *
 * Dos matices que cargan significado, y pasan los seis checks en claro Y en
 * oscuro con la misma pareja — incluido ΔE 10.3 bajo protanopia, que es lo que
 * importa aquí: el color distingue "entra" de "sale", así que si esos dos se
 * confunden el gráfico miente. El verde de marca (olive) daba ΔE 4.0 contra el
 * ember y quedó descartado; el mostaza quedó fuera por ΔE 11.1 contra el ember
 * incluso en visión normal.
 *
 * El resultado no lleva matiz propio: es neutro a propósito, porque un subtotal
 * no es ni entrada ni salida.
 */
const ENTRA = "#12907C";
const SALE = "#E85C2B";
const NEUTRO_CLARO = "#4E4436";

export function EstadoResultadosView({ datos }: { datos: EstadoResultados }) {
  const {
    ventas,
    domicilios,
    impuestos,
    costoVenta,
    consumoOperacion,
    utilidadBruta,
    margenBrutoPct,
    gastosFijos,
    gastosDelMes,
    mermas,
    utilidadNeta,
    margenNetoPct,
    retiroPresupuestado,
    retiroReal,
    quedaEnNegocio,
    detalleGastos,
    comprasDelMes,
    variacionInventario,
    pedidos,
  } = datos;

  // Los tramos los arma `construirCascada` en lib/contabilidad, aparte del
  // componente: ahí se pueden probar sin montar React, y ahí vivía el bug que
  // dibujaba una pérdida como si fuera ganancia.
  const cascada = React.useMemo(
    () =>
      construirCascada({
        ventas,
        costoVenta,
        consumoOperacion,
        utilidadBruta,
        gastosFijos,
        gastosDelMes,
        mermas,
        utilidadNeta,
      }),
    [ventas, costoVenta, consumoOperacion, utilidadBruta, gastosFijos, gastosDelMes, mermas, utilidadNeta]
  );

  // Un resultado negativo se pinta como salida: una pérdida no es un subtotal
  // neutro, y dejarla en gris la hacía leer como si fuera plata ganada.
  const colorDe = (b: TramoCascada) =>
    b.rol === "entra" ? ENTRA : b.rol === "sale" ? SALE : b.monto < 0 ? SALE : NEUTRO_CLARO;
  const enGanancia = utilidadNeta >= 0;

  if (ventas === 0 && costoVenta === 0 && consumoOperacion === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-200 p-10 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
        No hay ventas registradas en este mes todavía.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── El número que importa ───────────────────────────────────────── */}
      <div
        className={`rounded-2xl border p-5 ${
          enGanancia
            ? "border-teal-200 bg-teal-50/60 dark:border-teal-800 dark:bg-teal-900/20"
            : "border-ember-200 bg-ember-50/60 dark:border-ember-800 dark:bg-ember-900/20"
        }`}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-charcoal-400">
              {enGanancia ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              Utilidad neta del mes
            </p>
            <p
              className="mt-1 font-display text-4xl"
              style={{ color: enGanancia ? ENTRA : SALE }}
            >
              {formatCosto(utilidadNeta)}
            </p>
            <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">
              {margenNetoPct.toFixed(1)}% de las ventas · {pedidos} pedido{pedidos === 1 ? "" : "s"}
            </p>
          </div>
          {(retiroReal > 0 || retiroPresupuestado > 0) && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-charcoal-400">Menos retiro de socios</p>
              <p className="font-mono text-sm text-charcoal-500 dark:text-charcoal-300">−{formatCosto(retiroReal)}</p>
              {retiroPresupuestado > 0 && (
                <p className="text-[11px] text-charcoal-400">
                  de {formatCosto(retiroPresupuestado)} del cupo
                  {retiroReal > retiroPresupuestado
                    ? ` · ${formatCosto(retiroReal - retiroPresupuestado)} por encima`
                    : ""}
                </p>
              )}
              <p className="mt-1 text-xs uppercase tracking-wide text-charcoal-400">Queda en el negocio</p>
              <p className="font-display text-xl text-charcoal-900 dark:text-cream">{formatCosto(quedaEnNegocio)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Cascada ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">
            DE LA VENTA A LA UTILIDAD
          </h2>
          <div className="flex gap-4 text-xs text-charcoal-500 dark:text-charcoal-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ENTRA }} /> Entra
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SALE }} /> Sale
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-charcoal-500 dark:bg-charcoal-200" /> Resultado
            </span>
          </div>
        </div>
        <p className="mb-4 text-xs text-charcoal-400">
          Cada barra arranca donde terminó la anterior: así se ve cuánto de cada venta se va consumiendo.
        </p>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={cascada} margin={{ top: 20, right: 10, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DC" vertical={false} />
            <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: "#7A6C58" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#A99C88" }}
              axisLine={false}
              tickLine={false}
              width={78}
              tickFormatter={(v: number) => formatCosto(v)}
            />
            <Tooltip
              cursor={{ fill: "rgba(122,108,88,0.06)" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #E8E3DC", fontSize: 13 }}
              formatter={(_v, _n, item) => {
                const p = item?.payload as TramoCascada;
                return [`${p.monto < 0 ? "−" : ""}${formatCosto(Math.abs(p.monto))}`, p.nombre];
              }}
              labelFormatter={() => ""}
            />
            <ReferenceLine y={0} stroke="#A99C88" />
            <Bar dataKey="rango" radius={4} maxBarSize={64}>
              {cascada.map((b, i) => (
                <Cell key={i} fill={colorDe(b)} />
              ))}
              <LabelList
                dataKey="monto"
                position="top"
                formatter={(v: number) => `${v < 0 ? "−" : ""}${formatCosto(Math.abs(v))}`}
                style={{ fontSize: 11, fill: "#4E4436" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── A dónde se va la plata ───────────────────────────────────── */}
        <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
          <h2 className="mb-1 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">
            A DÓNDE SE VA LA PLATA
          </h2>
          <p className="mb-4 text-xs text-charcoal-400">Sin contar los insumos, que van en el costo de venta.</p>

          {detalleGastos.length === 0 ? (
            <p className="py-12 text-center text-sm text-charcoal-400">Sin gastos registrados este mes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, detalleGastos.length * 40)}>
              <BarChart data={detalleGastos} layout="vertical" margin={{ top: 0, right: 70, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="etiqueta"
                  tick={{ fontSize: 12, fill: "#4E4436" }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip
                  cursor={{ fill: "rgba(122,108,88,0.06)" }}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E8E3DC", fontSize: 13 }}
                  formatter={(v: number) => [formatCosto(v), "Gasto"]}
                />
                {/* Un solo matiz: todas estas barras son lo mismo — plata que
                    sale. La longitud ya ordena; darles colores distintos
                    inventaría categorías que no significan nada. */}
                <Bar dataKey="monto" fill={SALE} radius={[0, 4, 4, 0]} maxBarSize={22}>
                  <LabelList
                    dataKey="monto"
                    position="right"
                    formatter={(v: number) => formatCosto(v)}
                    style={{ fontSize: 11, fill: "#7A6C58" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── El cuadre ────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
          <h2 className="mb-4 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">EL CUADRE</h2>

          <dl className="space-y-2.5 text-sm">
            <Fila etiqueta="Ventas" valor={ventas} signo="+" nota="comida, sin domicilio ni impuesto" />
            <Fila etiqueta="Insumos consumidos" valor={costoVenta} signo="−" />
            {consumoOperacion > 0 && (
              <Fila etiqueta="Desechables y empaque" valor={consumoOperacion} signo="−" />
            )}
            <Fila etiqueta="Utilidad bruta" valor={utilidadBruta} destacado nota={`${margenBrutoPct.toFixed(1)}%`} />
            <hr className="border-charcoal-100 dark:border-charcoal-700" />
            <Fila etiqueta="Gastos fijos" valor={gastosFijos} signo="−" />
            {gastosDelMes > 0 && <Fila etiqueta="Gastos del mes" valor={gastosDelMes} signo="−" />}
            {mermas > 0 && <Fila etiqueta="Mermas y pérdidas" valor={mermas} signo="−" />}
            <Fila etiqueta="Utilidad neta" valor={utilidadNeta} destacado nota={`${margenNetoPct.toFixed(1)}%`} />
            {(retiroReal > 0 || retiroPresupuestado > 0) && (
              <>
                <hr className="border-charcoal-100 dark:border-charcoal-700" />
                {/* El presupuesto es la meta; lo retirado es lo que pasó. Se
                    muestran los dos porque son preguntas distintas: uno dice
                    cuánto hay que vender, el otro cuánto quedó adentro. */}
                <Fila
                  etiqueta="Retiro de socios"
                  valor={retiroReal}
                  signo="−"
                  nota={
                    retiroPresupuestado > 0
                      ? `cupo ${formatCosto(retiroPresupuestado)}`
                      : undefined
                  }
                />
                <Fila etiqueta="Queda en el negocio" valor={quedaEnNegocio} destacado />
              </>
            )}
          </dl>

          {(domicilios > 0 || impuestos > 0) && (
            // Ni lo uno ni lo otro es ingreso del negocio, pero pasan por la
            // caja y hay que poder verlos: el domicilio entra y vuelve a salir
            // hacia el domiciliario, y el impuesto es plata de la DIAN.
            <div className="mt-4 rounded-xl border border-dashed border-charcoal-200 p-3 text-xs text-charcoal-500 dark:border-charcoal-600 dark:text-charcoal-300">
              <p className="mb-1.5 font-medium uppercase tracking-wide text-charcoal-400">Cobrado aparte</p>
              {domicilios > 0 && (
                <p>
                  Domicilios: <strong>{formatCosto(domicilios)}</strong> — entra y vuelve a salir hacia quien reparte.
                  Si le pagaste al domiciliario, ese pago va como gasto.
                </p>
              )}
              {impuestos > 0 && (
                <p className="mt-1">
                  Impuesto recaudado: <strong>{formatCosto(impuestos)}</strong> — es plata de la DIAN que estás
                  guardando, no utilidad tuya.
                </p>
              )}
            </div>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-charcoal-50 p-3 text-xs text-charcoal-500 dark:bg-charcoal-900/40 dark:text-charcoal-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>
                Le pagaste <strong>{formatCosto(comprasDelMes)}</strong> a proveedores este mes, y de la despensa
                salieron <strong>{formatCosto(costoVenta + consumoOperacion + mermas)}</strong> entre insumos,
                desechables y mermas.
              </p>
              <p className="mt-1">
                {variacionInventario > 0
                  ? `Los ${formatCosto(variacionInventario)} de diferencia no se perdieron: están en la despensa. Por eso el costo de venta no son las compras.`
                  : variacionInventario < 0
                    ? `Consumiste ${formatCosto(-variacionInventario)} más de lo que compraste: este mes se gastó despensa que ya tenías.`
                    : "Compraste exactamente lo que consumiste."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  signo,
  destacado,
  nota,
}: {
  etiqueta: string;
  valor: number;
  signo?: "+" | "−";
  destacado?: boolean;
  nota?: string;
}) {
  // El signo sale del valor, no solo del parámetro `signo`. Antes se anteponía
  // "−" únicamente cuando la línea era un egreso declarado, así que una
  // utilidad NEGATIVA —que no lleva ese parámetro— se imprimía en positivo: la
  // tabla decía "$853.923" de utilidad cuando la realidad era una pérdida de
  // esa cifra, y contradecía a la tarjeta de arriba.
  const negativo = signo === "−" || valor < 0;

  return (
    <div className={`flex items-baseline justify-between gap-3 ${destacado ? "font-semibold" : ""}`}>
      <dt className={destacado ? "text-charcoal-900 dark:text-cream" : "text-charcoal-500 dark:text-charcoal-300"}>
        {etiqueta}
        {nota && <span className="ml-1.5 text-xs font-normal text-charcoal-400">({nota})</span>}
      </dt>
      <dd className="font-mono tabular-nums">
        <span
          className={
            destacado && valor < 0
              ? "text-red-600 dark:text-red-400"
              : destacado
                ? "text-charcoal-900 dark:text-cream"
                : "text-charcoal-600 dark:text-charcoal-200"
          }
        >
          {negativo ? "−" : ""}
          {formatCosto(Math.abs(valor))}
        </span>
      </dd>
    </div>
  );
}
