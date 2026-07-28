import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RewardsGrid } from "@/components/dashboard/rewards-grid";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function RewardsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [user, rewards, redemptions] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.reward.findMany({ where: { active: true }, orderBy: { pointsCost: "asc" } }),
    prisma.redemption.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { reward: true },
    }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">RECOMPENSAS</h1>
        <p className="mt-1 text-sm text-charcoal-400">Tienes {user.points} puntos disponibles para canjear.</p>
      </div>

      {rewards.length === 0 ? (
        <Card className="p-6 text-center text-sm text-charcoal-400">Aún no hay recompensas disponibles. ¡Vuelve pronto!</Card>
      ) : (
        <RewardsGrid rewards={rewards} userPoints={user.points} />
      )}

      {redemptions.length > 0 && (
        <div>
          <h2 className="mb-4 font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">TUS CANJES</h2>
          <div className="space-y-3">
            {redemptions.map((r) => (
              <Card key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-charcoal-900 dark:text-cream">{r.reward.name}</p>
                  <p className="text-xs text-charcoal-400">{formatDate(r.createdAt)} · código {r.code}</p>
                </div>
                <Badge variant={r.status === "ENTREGADO" ? "olive" : "mustard"}>{r.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
