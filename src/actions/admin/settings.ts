"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { setSetting, DEFAULT_SETTINGS } from "@/lib/settings";
import type { ActionResult } from "@/actions/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
}

const settingsSchema = z.record(z.string(), z.string());

export async function updateSettings(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Datos inválidos" };

  await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
      setSetting(key as keyof typeof DEFAULT_SETTINGS, value as string)
    )
  );

  revalidatePath("/admin/configuracion");
  return { success: true };
}
