import { InventarioTabs } from "@/components/admin/inventario-tabs";
import { CostosFijosManager } from "@/components/admin/costos-fijos-manager";
import { obtenerPanoramaOperacion } from "@/lib/operacion";

export const dynamic = "force-dynamic";

export default async function AdminCostosFijosPage() {
  const panorama = await obtenerPanoramaOperacion();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
          INVENTARIO · COSTOS FIJOS
        </h1>
        <InventarioTabs />
      </div>
      <CostosFijosManager panorama={panorama} />
    </div>
  );
}
