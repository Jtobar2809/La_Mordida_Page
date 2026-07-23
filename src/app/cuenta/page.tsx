import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoyaltyQrCard } from "@/components/dashboard/loyalty-qr-card";
import { RedeemCodeForm } from "@/components/dashboard/redeem-code-form";
import { formatDate, formatCOP } from "@/lib/utils";
import { Flame, ArrowRight } from "lucide-react";

export default async function AccountOverviewPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [user, levels, recentOrders] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, include: { level: true } }),
    prisma.level.findMany({ orderBy: { minPoints: "asc" } }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { items: true },
    }),
  ]);

  const earnedAgg = await prisma.pointsTransaction.aggregate({
    where: { userId: session.user.id, points: { gt: 0 } },
    _sum: { points: true },
  });
  const historicPoints = earnedAgg._sum.points ?? 0;

  const currentLevelIndex = levels.findIndex((l) => l.id === user.levelId);
  const nextLevel = levels[currentLevelIndex + 1];
  const progressPct = nextLevel
    ? Math.min(100, Math.round(((historicPoints - (levels[currentLevelIndex]?.minPoints ?? 0)) / (nextLevel.minPoints - (levels[currentLevelIndex]?.minPoints ?? 0))) * 100))
    : 100;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-charcoal-400">Hola,</p>
        <h1 className="font-display text-4xl tracking-wide text-charcoal-900 dark:text-cream">{user.name?.split(" ")[0] ?? "cliente"} 👋</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card bite className="lg:col-span-2">
          <div className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow mb-1">Tu saldo</p>
              <p className="font-display text-5xl text-ember-600">{user.points} pts</p>
              <p
                className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white"
                style={{ backgroundColor: user.level?.color ?? "#E85C2B" }}
              >
                <Flame className="h-4 w-4" /> Nivel {user.level?.name ?? "Bronce"}
              </p>
            </div>
            <div className="w-full sm:w-52">
              {nextLevel ? (
                <>
                  <div className="mb-1 flex justify-between text-xs text-charcoal-400">
                    <span>{user.level?.name}</span>
                    <span>{nextLevel.name}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-charcoal-100 dark:bg-charcoal-700">
                    <div className="h-full rounded-full bg-ember-gradient transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-charcoal-400">
                    {Math.max(0, nextLevel.minPoints - historicPoints)} pts para {nextLevel.name}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-ember-600">¡Nivel máximo alcanzado! 🎉</p>
              )}
            </div>
          </div>
        </Card>

        <LoyaltyQrCard userId={user.id} name={user.name ?? "cliente"} />
      </div>

      <Card className="p-6">
        <h2 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">¿COMPRASTE EN TIENDA?</h2>
        <p className="mt-1 text-sm text-charcoal-400">Ingresa el código que te dieron en caja para sumar esos puntos a tu cuenta.</p>
        <div className="mt-4">
          <RedeemCodeForm />
        </div>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">PEDIDOS RECIENTES</h2>
          <Link href="/cuenta/pedidos" className="flex items-center gap-1 text-sm font-semibold text-ember-600">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <Card className="p-6 text-center text-sm text-charcoal-400">Aún no tienes pedidos. ¡Ve al menú y estrena tu cuenta!</Card>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Card key={order.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-charcoal-900 dark:text-cream">Pedido #{order.id.slice(-6).toUpperCase()}</p>
                  <p className="text-xs text-charcoal-400">
                    {formatDate(order.createdAt)} · {order.items.length} producto(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-ember-600">{formatCOP(order.total)}</p>
                  <p className="text-xs text-charcoal-400">{order.status.replaceAll("_", " ")}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Link href="/menu">
        <Button size="lg">Hacer un nuevo pedido</Button>
      </Link>
    </div>
  );
}
