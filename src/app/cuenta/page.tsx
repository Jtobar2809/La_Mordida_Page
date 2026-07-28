import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatCOP } from "@/lib/utils";
import { ArrowRight, Stamp } from "lucide-react";
import { getStampCard, STAMPS_REQUIRED } from "@/lib/stamps";

export default async function AccountOverviewPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [user, recentOrders, stampCard] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { items: true },
    }),
    getStampCard(session.user.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-charcoal-400">Hola,</p>
        <h1 className="font-display text-4xl tracking-wide text-charcoal-900 dark:text-cream">
          {user.name?.split(" ")[0] ?? "cliente"} 👋
        </h1>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ember-gradient text-white shadow-glow">
              <Stamp className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">
                TARJETA DE SELLOS
              </h2>
              <p className="text-sm text-charcoal-400">
                {stampCard.rewardReady
                  ? "¡Tienes una hamburguesa gratis lista para reclamar!"
                  : `${stampCard.currentStamps} / ${STAMPS_REQUIRED} sellos juntados`}
              </p>
            </div>
          </div>
          <Link href="/cuenta/sellos">
            <Button size="sm" variant="secondary">
              Ver tarjeta <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
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
          <Card className="p-6 text-center text-sm text-charcoal-400">
            Aún no tienes pedidos. ¡Ve al menú y estrena tu cuenta!
          </Card>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Card key={order.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-charcoal-900 dark:text-cream">
                    Pedido #{order.id.slice(-6).toUpperCase()}
                  </p>
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
