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

const recetaItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string(),
  insumoId: z.string(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
});

export async function upsertRecetaItem(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = recetaItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, productId, insumoId, cantidad } = parsed.data;

  try {
    if (id) {
      await prisma.recetaItem.update({ where: { id }, data: { cantidad } });
    } else {
      await prisma.recetaItem.create({ data: { productId, insumoId, cantidad } });
    }
  } catch {
    return { success: false, error: "Este insumo ya está en la receta de este producto. Edita la cantidad existente." };
  }

  revalidatePath("/admin/inventario/recetas");
  return { success: true };
}

export async function deleteRecetaItem(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.recetaItem.delete({ where: { id } });
  revalidatePath("/admin/inventario/recetas");
  return { success: true };
}
