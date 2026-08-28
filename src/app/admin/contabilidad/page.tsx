import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EstadoResultadosView } from "@/components/admin/estado-resultados";
import { GastosManager } from "@/components/admin/gastos-manager";
import { ContabilidadTabs } from "@/components/admin/contabilidad-tabs";
import { RetirosPanel } from "@/components/admin/retiros-panel";
import { SaldosPanel } from "@/components/admin/saldos-panel";
import { obtenerEstadoResultados, MESES } from "@/lib/contabilidad";
import { obtenerCupoRetiros } from "@/lib/retiros";
import { obtenerSaldos } from "@/lib/saldos";

export const dynamic = "force-dynamic";

/** Los últimos 6 meses, del más reciente al más viejo. */
function mesesRecientes(cantidad = 6) {
  const hoy = new Date();
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  });
}

export default async function AdminContabilidadPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const { anio: anioParam, mes: mesParam } = await searchParams;
  const hoy = new Date();

  const anio = Number(anioParam) || hoy.getFullYear();
  const mesNum = Number(mesParam);
  const mes = mesNum >= 1 && mesNum <= 12 ? mesNum : hoy.getMonth() + 1;

  const desde = new Date(anio, mes - 1, 1);
  const hasta = new Date(anio, mes, 1);

  const [datos, gastos, cupoRetiros, saldos] = await Promise.all([
    obtenerEstadoResultados(anio, mes),
    prisma.gasto.findMany({ where: { fecha: { gte: desde, lt: hasta } }, orderBy: { fecha: "desc" } }),
    obtenerCupoRetiros(anio, mes),
    // No recibe el mes a propósito: un saldo es de hoy, no de agosto. Ver
    // lib/saldos.ts.
    obtenerSaldos(),
  ]);

  const opciones = mesesRecientes();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CONTABILIDAD</h1>
          <p className="text-sm text-charcoal-400">
            {MESES[mes - 1]} de {anio}
            {datos.esMesEnCurso ? " · mes en curso" : ""}
          </p>
        </div>

        <ContabilidadTabs anio={anio} mes={mes} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap gap-2 text-sm">
          {opciones.map((o) => {
            const activo = o.anio === anio && o.mes === mes;
            return (
              <Link
                key={`${o.anio}-${o.mes}`}
                href={`/admin/contabilidad?anio=${o.anio}&mes=${o.mes}`}
                className={
                  activo
                    ? "rounded-full bg-ember-gradient px-4 py-2 font-medium text-white shadow-glow"
                    : "rounded-full px-4 py-2 font-medium text-charcoal-600 hover:bg-charcoal-100 dark:text-cream dark:hover:bg-charcoal-700/50"
                }
              >
                {(MESES[o.mes - 1] ?? "").slice(0, 3)} {String(o.anio).slice(2)}
              </Link>
            );
          })}
        </nav>
      </div>

      {datos.esMesEnCurso && (
        <p className="rounded-xl bg-charcoal-50 px-4 py-2.5 text-xs text-charcoal-500 dark:bg-charcoal-900/40 dark:text-charcoal-300">
          El mes va en curso, pero los gastos fijos se cuentan completos: el arriendo se paga entero así el mes no haya
          terminado. La utilidad va a mejorar a medida que entren más ventas.
        </p>
      )}

      <EstadoResultadosView datos={datos} />

      <SaldosPanel saldos={saldos} />

      <RetirosPanel cupo={cupoRetiros} />

      <GastosManager gastos={gastos} />
    </div>
  );
}
