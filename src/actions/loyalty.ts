"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { redeemPurchaseCode, redeemReward } from "@/lib/points";
import type { ActionResult } from "@/actions/auth";

const codeSchema = z.object({ code: z.string().min(4, "Ingresa un código válido") });

export async function redeemCodeAction(input: unknown): Promise<ActionResult<{ points: number }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Debes iniciar sesión." };

  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Código inválido" };

  try {
    const points = await redeemPurchaseCode(session.user.id, parsed.data.code);
    revalidatePath("/cuenta");
    return { success: true, data: { points } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo canjear el código." };
  }
}

export async function redeemRewardAction(rewardId: string): Promise<ActionResult<{ code: string }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Debes iniciar sesión." };

  try {
    const redemption = await redeemReward(session.user.id, rewardId);
    revalidatePath("/cuenta/recompensas");
    return { success: true, data: { code: redemption.code } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo canjear la recompensa." };
  }
}
