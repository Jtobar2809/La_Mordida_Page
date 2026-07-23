"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
}

const rewardSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  pointsCost: z.coerce.number().int().positive(),
  stock: z.coerce.number().int().nonnegative().optional(),
  image: z.string().optional(),
  active: z.boolean().default(true),
});

export async function upsertReward(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = rewardSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, ...data } = parsed.data;

  if (id) {
    await prisma.reward.update({ where: { id }, data });
  } else {
    await prisma.reward.create({ data });
  }

  revalidatePath("/admin/recompensas");
  revalidatePath("/cuenta/recompensas");
  return { success: true };
}

export async function deleteReward(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.reward.delete({ where: { id } });
  revalidatePath("/admin/recompensas");
  return { success: true };
}
