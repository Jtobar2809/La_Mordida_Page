import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { PointsType } from "@prisma/client";

/**
 * Calcula cuántos puntos gana un usuario por un monto de compra,
 * usando la tasa configurable (pointsPerPeso) y el multiplicador de su nivel.
 */
export async function calculatePointsForAmount(amount: number, userId: string) {
  const settings = await getSettings();
  const rate = Number(settings.pointsPerPeso) || 1000;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { level: true },
  });

  const multiplier = user?.level?.multiplier ?? 1;
  const basePoints = Math.floor(amount / rate);
  return Math.floor(basePoints * multiplier);
}

/**
 * Otorga puntos a un usuario, registra la transacción y reevalúa su nivel.
 * Reutilizable desde: confirmación de pedido, canje de código, ajuste manual del admin, desafíos.
 */
export async function awardPoints(params: {
  userId: string;
  points: number;
  type: PointsType;
  description: string;
  orderId?: string;
}) {
  const { userId, points, type, description, orderId } = params;

  await prisma.$transaction([
    prisma.pointsTransaction.create({
      data: { userId, points, type, description, orderId },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { points: { increment: points } },
    }),
  ]);

  await reevaluateLevel(userId);
}

/**
 * Recalcula el nivel de un usuario según sus puntos históricos GANADOS
 * (no el saldo actual, para que canjear recompensas no baje de nivel al cliente).
 */
export async function reevaluateLevel(userId: string) {
  const earned = await prisma.pointsTransaction.aggregate({
    where: { userId, points: { gt: 0 } },
    _sum: { points: true },
  });
  const historicPoints = earned._sum.points ?? 0;

  const eligibleLevel = await prisma.level.findFirst({
    where: { minPoints: { lte: historicPoints } },
    orderBy: { minPoints: "desc" },
  });

  if (eligibleLevel) {
    await prisma.user.update({
      where: { id: userId },
      data: { levelId: eligibleLevel.id },
    });
  }
}

/**
 * Un cliente canjea un código generado por el administrador
 * para registrar los puntos de una compra realizada en caja/mostrador.
 */
export async function redeemPurchaseCode(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();

  const redemptionCode = await prisma.redemptionCode.findUnique({
    where: { code },
  });

  if (!redemptionCode) throw new Error("El código ingresado no existe.");
  if (!redemptionCode.active) throw new Error("Este código ya no está activo.");
  if (redemptionCode.expiresAt && redemptionCode.expiresAt < new Date()) {
    throw new Error("Este código ha expirado.");
  }
  if (redemptionCode.uses >= redemptionCode.maxUses) {
    throw new Error("Este código ya alcanzó su límite de usos.");
  }

  const alreadyUsed = await prisma.codeRedemption.findUnique({
    where: {
      userId_redemptionCodeId: { userId, redemptionCodeId: redemptionCode.id },
    },
  });
  if (alreadyUsed) throw new Error("Ya reclamaste este código anteriormente.");

  await prisma.$transaction([
    prisma.codeRedemption.create({
      data: {
        userId,
        redemptionCodeId: redemptionCode.id,
        pointsEarned: redemptionCode.pointsValue,
      },
    }),
    prisma.redemptionCode.update({
      where: { id: redemptionCode.id },
      data: { uses: { increment: 1 } },
    }),
  ]);

  await awardPoints({
    userId,
    points: redemptionCode.pointsValue,
    type: PointsType.GANADO_CODIGO,
    description: redemptionCode.description ?? `Código ${code}`,
  });

  return redemptionCode.pointsValue;
}

/** Un cliente canjea puntos por una recompensa del catálogo */
export async function redeemReward(userId: string, rewardId: string) {
  const [user, reward] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.reward.findUniqueOrThrow({ where: { id: rewardId } }),
  ]);

  if (!reward.active) throw new Error("Esta recompensa ya no está disponible.");
  if (reward.stock !== null && reward.stock <= 0) throw new Error("Recompensa agotada.");
  if (user.points < reward.pointsCost) throw new Error("No tienes puntos suficientes.");

  const { generateReadableCode } = await import("@/lib/utils");
  const code = generateReadableCode("PREM");

  const redemption = await prisma.$transaction(async (tx) => {
    const r = await tx.redemption.create({
      data: { userId, rewardId, pointsSpent: reward.pointsCost, code },
    });
    await tx.user.update({
      where: { id: userId },
      data: { points: { decrement: reward.pointsCost } },
    });
    await tx.pointsTransaction.create({
      data: {
        userId,
        points: -reward.pointsCost,
        type: PointsType.CANJEADO,
        description: `Canje: ${reward.name}`,
      },
    });
    if (reward.stock !== null) {
      await tx.reward.update({ where: { id: rewardId }, data: { stock: { decrement: 1 } } });
    }
    return r;
  });

  return redemption;
}
