import { prisma } from "@/lib/prisma";
import { RewardsManager } from "@/components/admin/rewards-manager";

export const dynamic = "force-dynamic";

export default async function AdminRewardsPage() {
  const rewards = await prisma.reward.findMany({ orderBy: { pointsCost: "asc" } });

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">RECOMPENSAS</h1>
      <p className="mb-6 text-sm text-charcoal-400">El catálogo que tus clientes pueden canjear con sus puntos.</p>
      <RewardsManager rewards={rewards} />
    </div>
  );
}
