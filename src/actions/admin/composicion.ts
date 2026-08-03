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

const componenteSchema = z.object({
  id: z.string().optional(),
  insumoElaboradoId: z.string(),
  insumoBaseId: z.string(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
});

export async function upsertComponente(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = componenteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, insumoElaboradoId, insumoBaseId, cantidad } = parsed.data;

  if (insumoElaboradoId === insumoBaseId) {
    return { success: false, error: "Un insumo no puede ser componente de sí mismo." };
  }

  try {
    if (id) {
      await prisma.insumoComponente.update({ where: { id }, data: { cantidad } });
    } else {
      await prisma.insumoComponente.create({ data: { insumoElaboradoId, insumoBaseId, cantidad } });
    }
  } catch {
    return { success: false, error: "Ese insumo ya está en la composición. Edita la cantidad existente." };
  }

  revalidatePath("/admin/inventario");
  return { success: true };
}

export async function deleteComponente(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.insumoComponente.delete({ where: { id } });
  revalidatePath("/admin/inventario");
  return { success: true };
}

/**
 * Suma el costo de cada componente (cantidad × costoUnitario) y lo guarda como
 * el costoUnitario del insumo elaborado. Como `cantidad` está definida "por
 * cada 1 [unidad del elaborado]", la suma ya da el costo por unidad — no hay
 * que dividir por ningún rendimiento de lote.
 */
export async function recalcularCostoElaborado(insumoId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const componentes = await prisma.insumoComponente.findMany({
    where: { insumoElaboradoId: insumoId },
    include: { insumoBase: { select: { costoUnitario: true } } },
  });

  if (componentes.length === 0) {
    return { success: false, error: "Este insumo todavía no tiene componentes definidos." };
  }

  const nuevoCosto = Math.round(componentes.reduce((sum, c) => sum + c.cantidad * c.insumoBase.costoUnitario, 0));

  await prisma.insumo.update({ where: { id: insumoId }, data: { costoUnitario: nuevoCosto } });

  revalidatePath("/admin/inventario");
  revalidatePath("/admin/inventario/recetas");
  return { success: true };
}
