"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/auth";

const profileSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(7),
  address: z.string().optional(),
  birthDate: z.string().optional(), // yyyy-mm-dd
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Debes iniciar sesión." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { name, phone, address, birthDate } = parsed.data;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      phone,
      address,
      birthDate: birthDate ? new Date(birthDate) : undefined,
    },
  });

  revalidatePath("/cuenta/perfil");
  return { success: true };
}
