import Link from "next/link";
import { ConciliacionView } from "@/components/admin/conciliacion-view";
import { ContabilidadTabs } from "@/components/admin/contabilidad-tabs";
import { obtenerConciliacion } from "@/lib/conciliacion";
import { MESES } from "@/lib/contabilidad";

export const dynamic = "force-dynamic";

function mesesRecientes(cantidad = 6) {
  const hoy = new Date();
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  });
}

export default async function AdminConciliacionPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const { anio: anioParam, mes: mesParam } = await searchParams;
  const hoy = new Date();

  const anio = Number(anioParam) || hoy.getFullYear();
  const mesNum = Number(mesParam);
  const mes = mesNum >= 1 && mesNum <= 12 ? mesNum : hoy.getMonth() + 1;

  const datos = await obtenerConciliacion(anio, mes);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CONCILIACIÓN</h1>
          <p className="text-sm text-charcoal-400">
            {MESES[mes - 1]} de {anio} · dónde el sistema y la realidad no coinciden
          </p>
        </div>
        <ContabilidadTabs anio={anio} mes={mes} />
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {mesesRecientes().map((o) => {
          const activo = o.anio === anio && o.mes === mes;
          return (
            <Link
              key={`${o.anio}-${o.mes}`}
              href={`/admin/contabilidad/conciliacion?anio=${o.anio}&mes=${o.mes}`}
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

      <ConciliacionView datos={datos} />
    </div>
  );
}
