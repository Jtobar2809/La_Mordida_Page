"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { generateStampQR, claimStamp, markStampRewardDelivered, getStampCard, STAMPS_REQUIRED } from "@/lib/stamps";
import type { ActionResult } from "@/actions/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session;
}

/**
 * El admin genera un nuevo QR de sello desde el mostrador, tras
 * confirmar una compra. Devuelve el token crudo — el componente de UI
 * lo codifica en el QR (nunca se expone el id interno de la fila).
 */
export async function generateStampQRAction(): Promise<ActionResult<{ token: string; claimUrl: string; expiresAt: string }>> {
  const session = await requireAdmin().catch(() => null);
  if (!session?.user?.id) return { success: false, error: "No autorizado" };

  const stampQR = await generateStampQR(session.user.id);
  revalidatePath("/admin/sellos");

  return {
    success: true,
    data: { token: stampQR.token, claimUrl: stampQR.claimUrl, expiresAt: stampQR.expiresAt.toISOString() },
  };
}

const claimSchema = z.object({ token: z.string().min(1) });

/**
 * El cliente (autenticado) escanea el QR y reclama el sello. Requiere
 * sesión — el sello siempre se ata a una cuenta real, nunca a un
 * dispositivo o sesión anónima.
 */
export async function claimStampAction(
  input: unknown
): Promise<ActionResult<{ currentStamps: number; cardCompleted: boolean; stampsRequired: number }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Inicia sesión para reclamar tu sello." };
  }

  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Código de sello inválido." };

  try {
    const result = await claimStamp(session.user.id, parsed.data.token);
    revalidatePath("/cuenta");
    return {
      success: true,
      data: {
        currentStamps: result.currentStamps,
        cardCompleted: result.cardCompleted,
        stampsRequired: STAMPS_REQUIRED,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo reclamar el sello.";
    return { success: false, error: message };
  }
}

/** Estado de la tarjeta del cliente actual, para renderizar en /cuenta */
export async function getMyStampCardAction() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return getStampCard(session.user.id);
}

/** El admin marca la recompensa de una tarjeta completa como entregada */
export async function markStampRewardDeliveredAction(stampCardId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  try {
    await markStampRewardDelivered(stampCardId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo marcar como entregada.";
    return { success: false, error: message };
  }

  revalidatePath("/admin/sellos");
  return { success: true };
}
