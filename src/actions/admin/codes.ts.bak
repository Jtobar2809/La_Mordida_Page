"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateReadableCode } from "@/lib/utils";
import type { ActionResult } from "@/actions/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session;
}

const codeSchema = z.object({
  pointsValue: z.coerce.number().int().positive(),
  description: z.string().optional(),
  maxUses: z.coerce.number().int().positive().default(1),
  expiresAt: z.string().optional(), // yyyy-mm-dd
  quantity: z.coerce.number().int().min(1).max(50).default(1),
});

/**
 * Genera uno o varios códigos de puntos para que los clientes registren
 * compras hechas en caja/mostrador. Se puede generar en lote (ej: 20 códigos
 * de 5 puntos para repartir en un evento).
 */
export async function generateCodes(input: unknown): Promise<ActionResult<{ codes: string[] }>> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { pointsValue, description, maxUses, expiresAt, quantity } = parsed.data;

  const codes: string[] = [];
  for (let i = 0; i < quantity; i++) {
    let code = generateReadableCode("LM");
    // aseguramos unicidad ante colisiones improbables
    // eslint-disable-next-line no-await-in-loop
    while (await prisma.redemptionCode.findUnique({ where: { code } })) {
      code = generateReadableCode("LM");
    }
    codes.push(code);
  }

  await prisma.redemptionCode.createMany({
    data: codes.map((code) => ({
      code,
      pointsValue,
      description,
      maxUses,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdById: session!.user.id,
    })),
  });

  revalidatePath("/admin/codigos");
  return { success: true, data: { codes } };
}

export async function toggleCodeActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.redemptionCode.update({ where: { id }, data: { active } });
  revalidatePath("/admin/codigos");
  return { success: true };
}

export async function deleteCode(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.redemptionCode.delete({ where: { id } });
  revalidatePath("/admin/codigos");
  return { success: true };
}
