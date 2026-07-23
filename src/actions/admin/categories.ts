"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/actions/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
}

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  icon: z.string().optional(),
  order: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

export async function upsertCategory(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, ...data } = parsed.data;
  const slug = slugify(data.name);

  try {
    if (id) {
      await prisma.category.update({ where: { id }, data: { ...data, slug } });
    } else {
      await prisma.category.create({ data: { ...data, slug } });
    }
  } catch {
    return { success: false, error: "Ya existe una categoría con un nombre muy similar." };
  }

  revalidatePath("/admin/categorias");
  revalidatePath("/menu");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const productsCount = await prisma.product.count({ where: { categoryId: id } });
  if (productsCount > 0) {
    return { success: false, error: "No puedes eliminar una categoría con productos. Muévelos primero." };
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categorias");
  return { success: true };
}
