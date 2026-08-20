import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { InventarioTabs } from "@/components/admin/inventario-tabs";
import { ConteoManager } from "@/components/admin/conteo-manager";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminConteoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const conteo = await prisma.conteoInventario.findUnique({
    where: { id },
    include: { items: { include: { insumo: true }, orderBy: { insumo: { nombre: "asc" } } } },
  });

  if (!conteo) notFound();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/inventario/conteo"
            className="mb-1 flex items-center gap-1 text-xs text-charcoal-400 hover:text-ember-500"
          >
            <ArrowLeft className="h-3 w-3" /> Todas las tomas
          </Link>
          <h1 className="flex items-center gap-3 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
            {conteo.codigo}
            {conteo.estado === "APLICADO" ? (
              <Badge variant="olive">Aplicado</Badge>
            ) : (
              <Badge variant="outline">En curso</Badge>
            )}
          </h1>
          <p className="text-sm text-charcoal-400">
            Abierto {formatDateTime(conteo.createdAt)}
            {conteo.aplicadoAt ? ` · aplicado ${formatDateTime(conteo.aplicadoAt)}` : ""}
          </p>
        </div>
        <InventarioTabs />
      </div>

      {conteo.estado === "APLICADO" && (
        <p className="mb-5 rounded-xl bg-charcoal-50 px-4 py-2.5 text-xs text-charcoal-500 dark:bg-charcoal-900/40 dark:text-charcoal-300">
          Este conteo ya se aplicó: los ajustes están en el libro mayor del inventario y las cifras de abajo quedan como
          comprobante histórico. No se edita.
        </p>
      )}

      <ConteoManager conteo={conteo} items={conteo.items} />
    </div>
  );
}
