import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { StampQRStatus } from "@prisma/client";

/** Sellos necesarios para completar una tarjeta y ganar la hamburguesa gratis */
export const STAMPS_REQUIRED = 7;

/** El QR es válido por 10 minutos desde que el admin lo genera */
const QR_EXPIRATION_MS = 10 * 60 * 1000;

/**
 * Genera un token de un solo uso para el QR de sello. Usa 32 bytes de
 * aleatoriedad criptográfica (crypto.randomBytes, no Math.random) porque
 * este valor viaja embebido en una URL que cualquiera con línea de
 * visión al mostrador podría fotografiar — a diferencia de
 * generateReadableCode (pensado para que un humano lo transcriba a
 * mano), este token nunca lo escribe nadie, así que puede y debe tener
 * muchísima más entropía.
 */
function generateStampToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * El admin genera un nuevo QR de sello desde el mostrador. El token es
 * genérico (no está atado a ningún cliente todavía) — el primer cliente
 * autenticado que lo escanee dentro de la ventana de expiración se
 * queda con el sello. Expira a los 10 minutos para que una foto de
 * pantalla tomada después de que el cliente se fue no sirva de nada.
 */
export async function generateStampQR(adminUserId: string) {
  const token = generateStampToken();
  const expiresAt = new Date(Date.now() + QR_EXPIRATION_MS);

  const stampQR = await prisma.stampQR.create({
    data: {
      token,
      generatedById: adminUserId,
      expiresAt,
    },
  });

  return stampQR;
}

export type ClaimStampResult = {
  currentStamps: number;
  cardCompleted: boolean;
  cardsCompleted: number;
};

/**
 * Un cliente autenticado escanea el QR y reclama el sello. TODA la
 * validación de seguridad vive aquí, en el servidor:
 *  1. El token debe existir.
 *  2. El "gane" del reclamo se decide con una escritura condicional
 *     atómica (updateMany ... WHERE status = PENDIENTE), no con un
 *     simple findUnique seguido de un update: dos escaneos casi
 *     simultáneos del mismo QR podrían ambos leer PENDIENTE antes de
 *     que cualquiera escriba, así que la comprobación real tiene que
 *     vivir en la condición WHERE de la propia escritura. Solo una de
 *     las dos peticiones logrará afectar la fila; la otra recibe 0
 *     filas modificadas y sabe que perdió la carrera.
 *  3. Si el QR ya expiró por tiempo (aunque su status en base de datos
 *     todavía diga PENDIENTE porque nadie lo había tocado), se
 *     rechaza igual y se marca EXPIRADO para limpieza.
 *  4. El incremento de la tarjeta (y su reinicio si llega a 7) ocurre
 *     en la misma transacción que ya ganó el reclamo del QR.
 */
export async function claimStamp(userId: string, rawToken: string): Promise<ClaimStampResult> {
  const token = rawToken.trim();
  if (!token) throw new Error("Código de sello inválido.");

  const stampQR = await prisma.stampQR.findUnique({ where: { token } });
  if (!stampQR) throw new Error("Este código de sello no existe.");

  if (stampQR.expiresAt < new Date()) {
    // Auto-limpieza: si nadie lo había marcado aún, lo dejamos EXPIRADO
    // para que futuras consultas no lo vean como válido.
    await prisma.stampQR.updateMany({
      where: { id: stampQR.id, status: StampQRStatus.PENDIENTE },
      data: { status: StampQRStatus.EXPIRADO },
    });
    throw new Error("Este código de sello expiró. Pide uno nuevo en el mostrador.");
  }

  return prisma.$transaction(async (tx) => {
    // Escritura condicional atómica: la carrera se resuelve aquí. Solo
    // el primer request que llegue con status aún PENDIENTE logra
    // afectar la fila; cualquier otro que llegue después (aunque haya
    // pasado la validación de arriba en paralelo) obtiene count: 0.
    const claim = await tx.stampQR.updateMany({
      where: { id: stampQR.id, status: StampQRStatus.PENDIENTE },
      data: { status: StampQRStatus.RECLAMADO, claimedById: userId, claimedAt: new Date() },
    });

    if (claim.count === 0) {
      throw new Error("Este código ya fue reclamado. Pide uno nuevo en el mostrador.");
    }

    // Obtiene o crea la tarjeta del cliente (todo cliente empieza en 0/7)
    let stampCard = await tx.stampCard.findUnique({ where: { userId } });
    if (!stampCard) {
      stampCard = await tx.stampCard.create({ data: { userId } });
    }

    const nextStamps = stampCard.currentStamps + 1;
    const cardCompleted = nextStamps >= STAMPS_REQUIRED;

    const updatedCard = await tx.stampCard.update({
      where: { id: stampCard.id },
      data: cardCompleted
        ? {
            // Se completó: se marca lista para reclamar la recompensa y
            // se reinicia el contador para la siguiente ronda de 7.
            currentStamps: 0,
            cardsCompleted: { increment: 1 },
            rewardReady: true,
          }
        : {
            currentStamps: nextStamps,
          },
    });

    await tx.stampQR.update({
      where: { id: stampQR.id },
      data: { stampCardId: updatedCard.id },
    });

    return {
      currentStamps: updatedCard.currentStamps,
      cardCompleted,
      cardsCompleted: updatedCard.cardsCompleted,
    };
  });
}

/** Estado actual de la tarjeta de un cliente, para mostrar en /cuenta */
export async function getStampCard(userId: string) {
  const card = await prisma.stampCard.findUnique({ where: { userId } });
  return (
    card ?? {
      id: null,
      userId,
      currentStamps: 0,
      cardsCompleted: 0,
      rewardReady: false,
      rewardClaimedAt: null,
    }
  );
}

/** El admin marca una recompensa de tarjeta completa como entregada (hamburguesa ya dada) */
export async function markStampRewardDelivered(stampCardId: string) {
  const card = await prisma.stampCard.findUniqueOrThrow({ where: { id: stampCardId } });
  if (!card.rewardReady) throw new Error("Esta tarjeta no tiene una recompensa pendiente.");

  return prisma.stampCard.update({
    where: { id: stampCardId },
    data: { rewardReady: false, rewardClaimedAt: new Date() },
  });
}
