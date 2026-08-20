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
} from "recharts";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { formatCosto } from "@/lib/costos";
import type { EstadoResultados } from "@/lib/contabilidad";

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

type Barra = { nombre: string; valor: number; rol: "entra" | "sale" | "resultado"; base: number };

export function EstadoResultadosView({ datos }: { datos: EstadoResultados }) {
  const {
    ventas,
    costoVenta,
    utilidadBruta,
    margenBrutoPct,
    gastosFijos,
    gastosDelMes,
    mermas,
    utilidadNeta,
    margenNetoPct,
    retiro,
    quedaEnNegocio,
    detalleGastos,
    comprasDelMes,
    variacionInventario,
    pedidos,
  } = datos;

  // Cascada: cada barra flotante arranca donde terminó la anterior, así se ve
  // cómo la venta se va consumiendo hasta la utilidad. `base` es la parte
  // invisible que la empuja hacia arriba.
  const cascada = React.useMemo<Barra[]>(() => {
    const pasos: Barra[] = [];
    pasos.push({ nombre: "Ventas", valor: ventas, rol: "entra", base: 0 });
    pasos.push({ nombre: "Insumos", valor: costoVenta, rol: "sale", base: ventas - costoVenta });
    pasos.push({ nombre: "Utilidad bruta", valor: Math.max(utilidadBruta, 0), rol: "resultado", base: 0 });

    let corriendo = utilidadBruta;
    for (const [nombre, monto] of [
      ["Fijos", gastosFijos],
      ["Gastos", gastosDelMes],
      ["Mermas", mermas],
    ] as const) {
      if (monto <= 0) continue;
      const siguiente = corriendo - monto;
      pasos.push({ nombre, valor: monto, rol: "sale", base: Math.max(Math.min(corriendo, siguiente), 0) });
      corriendo = siguiente;
    }

    pasos.push({ nombre: "Utilidad neta", valor: Math.abs(utilidadNeta), rol: "resultado", base: utilidadNeta < 0 ? 0 : 0 });
    return pasos;
  }, [ventas, costoVenta, utilidadBruta, gastosFijos, gastosDelMes, mermas, utilidadNeta]);

  const colorDe = (rol: Barra["rol"]) => (rol === "entra" ? ENTRA : rol === "sale" ? SALE : NEUTRO_CLARO);
  const enGanancia = utilidadNeta >= 0;

  if (ventas === 0 && costoVenta === 0) {
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
          {retiro > 0 && (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-charcoal-400">Menos retiro de socios</p>
              <p className="font-mono text-sm text-charcoal-500 dark:text-charcoal-300">−{formatCosto(retiro)}</p>
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
                const p = item?.payload as Barra;
                return [`${p.rol === "sale" ? "−" : ""}${formatCosto(p.valor)}`, p.nombre];
              }}
              labelFormatter={() => ""}
            />
            {/* Tramo invisible que levanta cada barra hasta donde va. */}
            <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="valor" stackId="c" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {cascada.map((b, i) => (
                <Cell key={i} fill={colorDe(b.rol)} />
              ))}
              <LabelList
                dataKey="valor"
                position="top"
                formatter={(v: number) => formatCosto(v)}
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
            <Fila etiqueta="Ventas" valor={ventas} signo="+" />
            <Fila etiqueta="Insumos consumidos" valor={costoVenta} signo="−" />
            <Fila etiqueta="Utilidad bruta" valor={utilidadBruta} destacado nota={`${margenBrutoPct.toFixed(1)}%`} />
            <hr className="border-charcoal-100 dark:border-charcoal-700" />
            <Fila etiqueta="Gastos fijos" valor={gastosFijos} signo="−" />
            {gastosDelMes > 0 && <Fila etiqueta="Gastos del mes" valor={gastosDelMes} signo="−" />}
            {mermas > 0 && <Fila etiqueta="Mermas y pérdidas" valor={mermas} signo="−" />}
            <Fila etiqueta="Utilidad neta" valor={utilidadNeta} destacado nota={`${margenNetoPct.toFixed(1)}%`} />
            {retiro > 0 && (
              <>
                <hr className="border-charcoal-100 dark:border-charcoal-700" />
                <Fila etiqueta="Retiro de socios" valor={retiro} signo="−" />
                <Fila etiqueta="Queda en el negocio" valor={quedaEnNegocio} destacado />
              </>
            )}
          </dl>

          <div className="mt-5 flex items-start gap-2 rounded-xl bg-charcoal-50 p-3 text-xs text-charcoal-500 dark:bg-charcoal-900/40 dark:text-charcoal-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>
                Le pagaste <strong>{formatCosto(comprasDelMes)}</strong> a proveedores este mes, pero solo consumiste{" "}
                <strong>{formatCosto(costoVenta)}</strong> en insumos.
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
  return (
    <div className={`flex items-baseline justify-between gap-3 ${destacado ? "font-semibold" : ""}`}>
      <dt className={destacado ? "text-charcoal-900 dark:text-cream" : "text-charcoal-500 dark:text-charcoal-300"}>
        {etiqueta}
        {nota && <span className="ml-1.5 text-xs font-normal text-charcoal-400">({nota})</span>}
      </dt>
      <dd
        className="font-mono tabular-nums"
        style={{ color: destacado ? (valor < 0 ? SALE : undefined) : undefined }}
      >
        <span className={destacado ? "text-charcoal-900 dark:text-cream" : "text-charcoal-600 dark:text-charcoal-200"}>
          {signo === "−" ? "−" : ""}
          {formatCosto(Math.abs(valor))}
        </span>
      </dd>
    </div>
  );
}
