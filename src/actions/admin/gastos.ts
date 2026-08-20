"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/auth";
import { GastoCategoria, MetodoPago } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session.user.id;
}

const gastoSchema = z.object({
  id: z.string().optional(),
  fecha: z.string().min(1, "Elige la fecha"),
  concepto: z.string().min(2, "Escribe de qué fue el gasto"),
  monto: z.coerce.number().int().positive("El monto debe ser mayor a 0"),
  categoria: z.nativeEnum(GastoCategoria).default("OTRO"),
  metodoPago: z.nativeEnum(MetodoPago).default("EFECTIVO"),
  notas: z.string().max(300).optional(),
});

export async function upsertGasto(input: unknown): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = gastoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, fecha, ...resto } = parsed.data;
  // La fecha llega como "2026-08-20" de un <input type="date">. Interpretarla
  // directo la trataría como medianoche UTC y en Colombia (UTC-5) caería el día
  // anterior, mandando el gasto al mes pasado cuando se registra un día 1.
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const fechaLocal = new Date(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1, 12, 0, 0);
  if (Number.isNaN(fechaLocal.getTime())) return { success: false, error: "La fecha no es válida" };

  const data = { ...resto, fecha: fechaLocal };

  if (id) {
    await prisma.gasto.update({ where: { id }, data });
  } else {
    await prisma.gasto.create({ data: { ...data, createdById: userId } });
  }

  revalidatePath("/admin/contabilidad");
  return { success: true };
}

export async function deleteGasto(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.gasto.delete({ where: { id } });
  revalidatePath("/admin/contabilidad");
  return { success: true };
}
