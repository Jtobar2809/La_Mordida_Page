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

// Validación para CREAR un producto: todos los campos base son obligatorios.
const createProductSchema = z.object({
  id: z.undefined(),
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

// Validación para EDITAR un producto existente: todo opcional. Solo lo
// que venga definido se valida y se actualiza; lo que no se incluya
// conserva su valor actual en la base de datos, sin necesidad de
// reenviar el formulario completo.
const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  price: z.coerce.number().int().positive().optional(),
  categoryId: z.string().min(1).optional(),
  image: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  extras: z.array(extraSchema).optional(),
  featured: z.boolean().optional(),
  available: z.boolean().optional(),
  spicyLevel: z.coerce.number().int().min(0).max(3).optional(),
});

const productSchema = z.union([createProductSchema, updateProductSchema]);

export async function upsertProduct(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, extras, ...data } = parsed.data;

  try {
    if (id) {
      // EDICIÓN: PATCH parcial. Solo los campos presentes en `data` se
      // incluyen en el update de Prisma — los que no se enviaron quedan
      // undefined y Prisma los omite del UPDATE, conservando el valor
      // actual en la base de datos sin necesidad de reenviarlo.
      const updateData: Record<string, unknown> = { ...data };
      if (data.name !== undefined) {
        updateData.slug = slugify(data.name);
      }

      await prisma.product.update({
        where: { id },
        data: updateData,
      });

      // Los extras solo se tocan si el formulario los incluyó explícitamente.
      // Si el campo no vino en el input, los extras existentes del
      // producto quedan exactamente como estaban.
      if (extras !== undefined) {
        await prisma.productExtra.deleteMany({ where: { productId: id } });
        if (extras.length > 0) {
          await prisma.productExtra.createMany({ data: extras.map((e) => ({ ...e, productId: id })) });
        }
      }
    } else {
      // CREACIÓN: aquí el schema ya garantizó que todos los campos
      // obligatorios están presentes.
      const createData = data as typeof data & { name: string; description: string; price: number; categoryId: string };
      const slug = slugify(createData.name);
      await prisma.product.create({
        data: { ...createData, slug, extras: { create: extras ?? [] } },
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
