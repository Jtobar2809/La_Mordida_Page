import { prisma } from "@/lib/prisma";
import { awardPoints } from "@/lib/points";
import { ChallengeType, PointsType, type Order, type OrderItem } from "@prisma/client";

type OrderWithItems = Order & { items: OrderItem[] };

/**
 * Evalúa todos los desafíos activos contra el historial del usuario
 * después de que un pedido se confirma. Simplificado pero extensible:
 * cada tipo de desafío sabe cómo calcular su propio progreso.
 */
export async function updateChallengesForOrder(userId: string, order: OrderWithItems) {
  const challenges = await prisma.challenge.findMany({
    where: {
      active: true,
      OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
    },
  });

  for (const challenge of challenges) {
    const progressValue = await computeProgress(userId, challenge.type, challenge.goal);

    const existing = await prisma.challengeProgress.upsert({
      where: { userId_challengeId: { userId, challengeId: challenge.id } },
      update: { progress: progressValue },
      create: { userId, challengeId: challenge.id, progress: progressValue },
    });

    const justCompleted = !existing.completed && progressValue >= challenge.goal;
    if (justCompleted) {
      await prisma.challengeProgress.update({
        where: { id: existing.id },
        data: { completed: true, completedAt: new Date(), progress: progressValue },
      });

      if (challenge.rewardPoints > 0) {
        await awardPoints({
          userId,
          points: challenge.rewardPoints,
          type: PointsType.GANADO_DESAFIO,
          description: `Desafío completado: ${challenge.title}`,
        });
      }
    }
  }
}

async function computeProgress(userId: string, type: ChallengeType, goal: number) {
  switch (type) {
    case ChallengeType.PEDIDOS_TOTALES: {
      return prisma.order.count({
        where: { userId, status: { not: "CANCELADO" } },
      });
    }
    case ChallengeType.CANTIDAD_PRODUCTO: {
      const items = await prisma.orderItem.findMany({
        where: { order: { userId, status: { not: "CANCELADO" } } },
        select: { quantity: true },
      });
      return items.reduce((sum, i) => sum + i.quantity, 0);
    }
    case ChallengeType.CATEGORIA_COMPLETA: {
      const distinctCategories = await prisma.orderItem.findMany({
        where: { order: { userId, status: { not: "CANCELADO" } } },
        select: { product: { select: { categoryId: true } } },
        distinct: ["productId"],
      });
      const totalCategories = await prisma.category.count({ where: { active: true } });
      const uniqueCats = new Set(distinctCategories.map((d) => d.product.categoryId));
      return uniqueCats.size >= totalCategories ? goal : uniqueCats.size;
    }
    case ChallengeType.RACHA_SEMANAS: {
      const orders = await prisma.order.findMany({
        where: { userId, status: { not: "CANCELADO" } },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return computeWeekStreak(orders.map((o) => o.createdAt));
    }
    case ChallengeType.CUMPLEANOS: {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.birthDate) return 0;
      const now = new Date();
      const sameMonth = now.getMonth() === new Date(user.birthDate).getMonth();
      if (!sameMonth) return 0;
      const ordersThisMonth = await prisma.order.count({
        where: {
          userId,
          status: { not: "CANCELADO" },
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      });
      return ordersThisMonth > 0 ? goal : 0;
    }
    // REFERIDO, PRODUCTO_NUEVO, COMBO: requieren datos externos (código de referido,
    // bandera de producto nuevo, id de combo específico) — se dejan en 0 por defecto
    // y se pueden actualizar manualmente desde el panel admin o extender aquí.
    default:
      return 0;
  }
}

function computeWeekStreak(datesDesc: Date[]) {
  if (datesDesc.length === 0) return 0;
  const weekKeys = new Set(
    datesDesc.map((d) => {
      const date = new Date(d);
      const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
      const week = Math.ceil(((date.getTime() - firstDayOfYear.getTime()) / 86400000 + firstDayOfYear.getDay() + 1) / 7);
      return `${date.getFullYear()}-${week}`;
    })
  );
  return weekKeys.size;
}
