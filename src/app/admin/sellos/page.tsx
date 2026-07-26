import { prisma } from "@/lib/prisma";
import { StampQRGenerator } from "@/components/admin/stamp-qr-generator";
import { StampRewardsTable } from "@/components/admin/stamp-rewards-table";

export const dynamic = "force-dynamic";

export default async function AdminStampsPage() {
  const readyCards = await prisma.stampCard.findMany({
    where: { rewardReady: true },
    include: { user: { select: { name: true, email: true, phone: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
          TARJETA DE SELLOS
        </h1>
        <p className="text-sm text-charcoal-400">
          Genera un código QR después de cada compra. El primer cliente que lo escanee desde su cuenta recibe el
          sello. Cada 7 sellos, el cliente gana una hamburguesa gratis.
        </p>
      </div>

      <StampQRGenerator />

      <div>
        <h2 className="mb-3 font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">
          Recompensas listas para entregar
        </h2>
        <StampRewardsTable cards={readyCards} />
      </div>
    </div>
  );
}
