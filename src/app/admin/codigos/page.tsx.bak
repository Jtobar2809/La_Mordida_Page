import { prisma } from "@/lib/prisma";
import { GenerateCodesForm } from "@/components/admin/generate-codes-form";
import { CodesTable } from "@/components/admin/codes-table";

export const dynamic = "force-dynamic";

export default async function AdminCodesPage() {
  const codes = await prisma.redemptionCode.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CÓDIGOS DE PUNTOS</h1>
        <p className="text-sm text-charcoal-400">
          Genera códigos para que tus clientes registren puntos de compras hechas en mostrador/caja física.
        </p>
      </div>
      <GenerateCodesForm />
      <CodesTable codes={codes} />
    </div>
  );
}
