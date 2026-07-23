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
  return session;
}

const extraSchema = z.object({ name: z.string().min(1), price: z.coerce.number().int().nonnegative() });

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  description: z.string().min(5),
  price: z.coerce.number().int().positive(),
  categoryId: z.string().min(1),
  image: z.string().optional(),
  ingredients: z.array(z.string()).default([]),
  extras: z.array(extraSchema).default([]),
  featured: z.boolean().default(false),
  available: z.boolean().default(true),
  spicyLevel: z.coerce.number().int().min(0).max(3).default(0),
});

export async function upsertProduct(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, extras, ...data } = parsed.data;
  const slug = slugify(data.name);

  try {
    if (id) {
      await prisma.product.update({
        where: { id },
        data: { ...data, slug },
      });
      await prisma.productExtra.deleteMany({ where: { productId: id } });
      if (extras.length > 0) {
        await prisma.productExtra.createMany({ data: extras.map((e) => ({ ...e, productId: id })) });
      }
    } else {
      await prisma.product.create({
        data: { ...data, slug, extras: { create: extras } },
      });
    }
  } catch {
    return { success: false, error: "Ya existe un producto con un nombre muy similar." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/menu");
  revalidatePath("/");
  return { success: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/productos");
  revalidatePath("/menu");
  return { success: true };
}

export async function toggleProductAvailability(id: string, available: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.product.update({ where: { id }, data: { available } });
  revalidatePath("/admin/productos");
  revalidatePath("/menu");
  return { success: true };
}
