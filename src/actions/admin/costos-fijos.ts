"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setSetting } from "@/lib/settings";
import type { ActionResult } from "@/actions/auth";
import { CostoFijoCategoria } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
}

function revalidar() {
  revalidatePath("/admin/inventario/costos");
  revalidatePath("/admin/inventario/resumen");
  revalidatePath("/admin/inventario/recetas");
}

const costoFijoSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(2, "Ponle un nombre al gasto"),
  monto: z.coerce.number().int().min(0, "El monto no puede ser negativo"),
  categoria: z.nativeEnum(CostoFijoCategoria).default("OTRO"),
  notas: z.string().max(300).optional(),
  activo: z.boolean().default(true),
});

export async function upsertCostoFijo(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = costoFijoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, ...data } = parsed.data;

  try {
    const guardado = id
      ? await prisma.costoFijo.update({ where: { id }, data })
      : await prisma.costoFijo.create({ data });
    revalidar();
    return { success: true, data: { id: guardado.id } };
  } catch {
    return { success: false, error: "Ya existe un gasto fijo con ese nombre." };
  }
}

export async function deleteCostoFijo(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.costoFijo.delete({ where: { id } });
  revalidar();
  return { success: true };
}

const supuestosSchema = z.object({
  ventasEstimadasMes: z.coerce.number().int().min(0),
  ticketPromedioEstimado: z.coerce.number().int().min(0),
  diasOperacionMes: z.coerce.number().int().min(1).max(31),
});

/**
 * Los supuestos con los que se calcula mientras no hay ventas registradas. En
 * cuanto empiecen a entrar pedidos, el panorama usa los datos reales y estos
 * quedan solo como referencia.
 */
export async function guardarSupuestos(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = supuestosSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await Promise.all([
    setSetting("ventasEstimadasMes", String(parsed.data.ventasEstimadasMes)),
    setSetting("ticketPromedioEstimado", String(parsed.data.ticketPromedioEstimado)),
    setSetting("diasOperacionMes", String(parsed.data.diasOperacionMes)),
  ]);

  revalidar();
  return { success: true };
}
