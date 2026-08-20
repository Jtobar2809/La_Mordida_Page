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

function revalidar() {
  revalidatePath("/admin/inventario/recetas");
  revalidatePath("/admin/inventario/resumen");
  revalidatePath("/admin/productos");
  revalidatePath("/menu");
}

const comboItemSchema = z.object({
  id: z.string().optional(),
  comboId: z.string().min(1),
  productoId: z.string().min(1),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
});

export async function upsertComboItem(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = comboItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, comboId, productoId, cantidad } = parsed.data;

  if (comboId === productoId) {
    return { success: false, error: "Un combo no puede contenerse a sí mismo." };
  }

  // Un solo nivel: si el producto que se quiere meter es a su vez un combo, se
  // rechaza. Anidar combos no resuelve ningún caso real del menú y obligaría a
  // defenderse de ciclos en todo el árbol, como pasa con los insumos elaborados.
  const producto = await prisma.product.findUnique({
    where: { id: productoId },
    select: { esCombo: true, name: true },
  });
  if (!producto) return { success: false, error: "Ese producto ya no existe." };
  if (producto.esCombo) {
    return { success: false, error: `"${producto.name}" ya es un combo. Un combo no puede llevar otro combo adentro.` };
  }

  try {
    if (id) {
      await prisma.comboItem.update({ where: { id }, data: { cantidad } });
    } else {
      await prisma.comboItem.create({ data: { comboId, productoId, cantidad } });
    }
  } catch {
    return { success: false, error: "Ese producto ya está en el combo. Edita la cantidad existente." };
  }

  revalidar();
  return { success: true };
}

export async function deleteComboItem(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.comboItem.delete({ where: { id } });
  revalidar();
  return { success: true };
}

/**
 * Marca o desmarca un producto como combo desde la pantalla de Recetas, sin
 * tener que abrir el formulario del producto.
 *
 * Al desmarcarlo se borran sus líneas: dejarlas escondidas haría que volver a
 * marcarlo como combo resucitara una composición vieja que nadie recuerda haber
 * definido.
 */
export async function marcarComoCombo(productId: string, esCombo: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.$transaction(async (tx) => {
    if (!esCombo) await tx.comboItem.deleteMany({ where: { comboId: productId } });
    await tx.product.update({ where: { id: productId }, data: { esCombo } });
  });

  revalidar();
  return { success: true };
}
