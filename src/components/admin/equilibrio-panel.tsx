import Link from "next/link";
import { Target, ArrowRight } from "lucide-react";
import { formatCosto } from "@/lib/costos";
import type { PanoramaOperacion } from "@/lib/operacion";

/**
 * El punto de equilibrio en el Dashboard, contra las ventas que van del mes.
 *
 * La cifra la calcula `obtenerPanoramaOperacion`, la misma que usa la pestaña de
 * Costos fijos, para que las dos pantallas nunca muestren números distintos.
 *
 * Lo que sí se calcula aquí es el prorrateo: comparar lo que llevas del mes
 * contra el objetivo del mes COMPLETO haría que el día 3 todo se viera
 * catastrófico y el día 30 todo bien, sin que nada hubiera cambiado. Lo útil es
 * si vas en ritmo para la fecha en que estás.
 */
export function EquilibrioPanel({
  panorama,
  ventasDelMes,
}: {
  panorama: PanoramaOperacion;
  ventasDelMes: number;
}) {
  const { totalFijoMes, ventasEquilibrio, ventasEquilibrioDia, pedidosEquilibrioDia, margenContribucion, origenMargen } =
    panorama;

  if (origenMargen === "SIN_DATOS" || ventasEquilibrio <= 0) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-200 p-5 text-sm text-charcoal-400 dark:border-charcoal-600">
        Para ver tu punto de equilibrio, registra tus gastos fijos en{" "}
        <Link href="/admin/inventario/costos" className="underline hover:text-ember-500">
          Inventario › Costos fijos
        </Link>{" "}
        y cuéstea al menos una receta.
      </div>
    );
  }

  const hoy = new Date();
  const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diaActual = hoy.getDate();
  // Cuánto deberías llevar acumulado hoy para terminar el mes en equilibrio.
  const esperadoALaFecha = (ventasEquilibrio * diaActual) / diasDelMes;

  const progreso = Math.min(ventasDelMes / ventasEquilibrio, 1);
  const enRitmo = ventasDelMes >= esperadoALaFecha;
  const cubierto = ventasDelMes >= ventasEquilibrio;

  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">
          <Target className="h-4 w-4 text-ember-500" /> PUNTO DE EQUILIBRIO
        </h2>
        <Link
          href="/admin/inventario/costos"
          className="flex items-center gap-1 text-xs text-charcoal-400 hover:text-ember-500"
        >
          Ajustar gastos fijos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Dato label="Necesitas vender al mes" valor={formatCosto(ventasEquilibrio)} destacado />
        <Dato label="Llevas este mes" valor={formatCosto(ventasDelMes)} />
        <Dato label="Por día" valor={formatCosto(ventasEquilibrioDia)} nota={pedidosEquilibrioDia !== null ? `${Math.ceil(pedidosEquilibrioDia)} pedidos diarios` : undefined} />
        <Dato
          label="Gastos fijos"
          valor={formatCosto(totalFijoMes)}
          nota={`margen ${(margenContribucion * 100).toFixed(1)}%${origenMargen === "RECETAS" ? " (de recetas)" : ""}`}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-charcoal-400">
          <span>
            Día {diaActual} de {diasDelMes} — para ir en ritmo deberías llevar {formatCosto(esperadoALaFecha)}
          </span>
          <span className={enRitmo ? "font-semibold text-olive-600 dark:text-olive-400" : "font-semibold text-amber-600"}>
            {(progreso * 100).toFixed(0)}% del mes
          </span>
        </div>

        <div className="relative h-2.5 overflow-hidden rounded-full bg-charcoal-100 dark:bg-charcoal-700">
          <div
            className={`h-full rounded-full ${cubierto ? "bg-olive-500" : enRitmo ? "bg-olive-400" : "bg-amber-500"}`}
            style={{ width: `${progreso * 100}%` }}
          />
          {/* Marca de dónde deberías ir hoy, para que la barra se lea sola. */}
          <div
            className="absolute top-0 h-full w-0.5 bg-charcoal-500 dark:bg-cream"
            style={{ left: `${Math.min((esperadoALaFecha / ventasEquilibrio) * 100, 100)}%` }}
            title="Dónde deberías ir hoy"
          />
        </div>

        <p className="mt-2 text-sm">
          {cubierto ? (
            <span className="text-olive-600 dark:text-olive-400">
              Ya cubriste los gastos del mes. De aquí en adelante te queda{" "}
              <strong>{(margenContribucion * 100).toFixed(1)}%</strong> de cada peso que vendas.
            </span>
          ) : enRitmo ? (
            <span className="text-olive-600 dark:text-olive-400">
              Vas en ritmo. Te faltan {formatCosto(ventasEquilibrio - ventasDelMes)} para cerrar el mes en equilibrio.
            </span>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">
              Vas {formatCosto(esperadoALaFecha - ventasDelMes)} por debajo del ritmo. Faltan{" "}
              {formatCosto(ventasEquilibrio - ventasDelMes)} para cubrir el mes.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function Dato({ label, valor, nota, destacado }: { label: string; valor: string; nota?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${destacado ? "bg-ember-50 dark:bg-ember-900/20" : "bg-charcoal-50 dark:bg-charcoal-900/40"}`}>
      <p className="text-xs uppercase tracking-wide text-charcoal-400">{label}</p>
      <p
        className={`mt-1 font-display text-xl ${destacado ? "text-ember-600 dark:text-ember-400" : "text-charcoal-900 dark:text-cream"}`}
      >
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs text-charcoal-400">{nota}</p>}
    </div>
  );
}
