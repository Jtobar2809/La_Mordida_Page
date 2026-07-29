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

const gallerySchema = z.object({
  id: z.string().optional(),
  image: z.string().min(1, "Sube o pega una imagen para la galería"),
  alt: z.string().optional(),
  order: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});

export async function upsertGalleryImage(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = gallerySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, ...data } = parsed.data;

  if (id) {
    await prisma.galleryImage.update({ where: { id }, data });
  } else {
    await prisma.galleryImage.create({ data });
  }

  revalidatePath("/admin/galeria");
  revalidatePath("/");
  return { success: true };
}

export async function deleteGalleryImage(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.galleryImage.delete({ where: { id } });
  revalidatePath("/admin/galeria");
  revalidatePath("/");
  return { success: true };
}

export async function toggleGalleryImageActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.galleryImage.update({ where: { id }, data: { active } });
  revalidatePath("/admin/galeria");
  revalidatePath("/");
  return { success: true };
}
