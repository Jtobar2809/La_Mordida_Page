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

const challengeSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3),
  description: z.string().min(5),
  type: z.enum([
    "CANTIDAD_PRODUCTO",
    "PEDIDOS_TOTALES",
    "RACHA_SEMANAS",
    "REFERIDO",
    "PRODUCTO_NUEVO",
    "CUMPLEANOS",
    "CATEGORIA_COMPLETA",
    "COMBO",
  ]),
  goal: z.coerce.number().int().positive(),
  rewardPoints: z.coerce.number().int().nonnegative().default(0),
  rewardDescription: z.string().optional(),
  badgeIcon: z.string().default("trophy"),
  active: z.boolean().default(true),
});

export async function upsertChallenge(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = challengeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, ...data } = parsed.data;

  if (id) {
    await prisma.challenge.update({ where: { id }, data });
  } else {
    await prisma.challenge.create({ data });
  }

  revalidatePath("/admin/desafios");
  revalidatePath("/cuenta/desafios");
  return { success: true };
}

export async function deleteChallenge(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.challenge.delete({ where: { id } });
  revalidatePath("/admin/desafios");
  return { success: true };
}

export async function toggleChallengeActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.challenge.update({ where: { id }, data: { active } });
  revalidatePath("/admin/desafios");
  return { success: true };
}
