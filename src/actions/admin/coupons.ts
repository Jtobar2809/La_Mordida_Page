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

const couponSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(3),
  discountType: z.enum(["PORCENTAJE", "FIJO"]),
  value: z.coerce.number().int().positive(),
  minOrder: z.coerce.number().int().nonnegative().default(0),
  usageLimit: z.coerce.number().int().positive().optional(),
  expiresAt: z.string().optional(),
  active: z.boolean().default(true),
});

export async function upsertCoupon(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, expiresAt, code, ...data } = parsed.data;
  const normalizedCode = code.toUpperCase().trim();

  try {
    if (id) {
      await prisma.coupon.update({
        where: { id },
        data: { ...data, code: normalizedCode, expiresAt: expiresAt ? new Date(expiresAt) : null },
      });
    } else {
      await prisma.coupon.create({
        data: { ...data, code: normalizedCode, expiresAt: expiresAt ? new Date(expiresAt) : null },
      });
    }
  } catch {
    return { success: false, error: "Ya existe un cupón con ese código." };
  }

  revalidatePath("/admin/cupones");
  return { success: true };
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.coupon.delete({ where: { id } });
  revalidatePath("/admin/cupones");
  return { success: true };
}

export async function toggleCouponActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.coupon.update({ where: { id }, data: { active } });
  revalidatePath("/admin/cupones");
  return { success: true };
}
