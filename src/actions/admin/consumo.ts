"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session.user.id;
}

const consumoSchema = z.object({
  fecha: z.string().optional(),
  notas: z.string().max(200).optional(),
  items: z
    .array(z.object({ insumoId: z.string().min(1), cantidad: z.coerce.number().positive() }))
    .min(1, "Escribe al menos una cantidad"),
});

/**
 * Descuenta de una sola vez lo que se gastó de los insumos de consumo manual
 * (bolsas, papel, desechables).
 *
 * En lote y no uno por uno porque el uso real es "al cerrar, anoto lo del día":
 * diez modales seguidos es una tarea que nadie sostiene, y un descuento que no
 * se hace es peor que no tener la función.
 */
export async function registrarConsumoManual(input: unknown): Promise<ActionResult<{ movimientos: number }>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = consumoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { items, notas } = parsed.data;

  // Fecha del <input type="date"> anclada al mediodía local: interpretarla como
  // medianoche UTC la correría al día anterior en Colombia.
  let fecha: Date | undefined;
  if (parsed.data.fecha) {
    const [a, m, d] = parsed.data.fecha.split("-").map(Number);
    if (a && m && d) {
      const local = new Date(a, m - 1, d, 12, 0, 0);
      if (!Number.isNaN(local.getTime())) fecha = local;
    }
  }

  const insumos = await prisma.insumo.findMany({
    where: { id: { in: items.map((i) => i.insumoId) } },
    select: { id: true, nombre: true, unidad: true, stockActual: true, costoUnitario: true },
  });

  // Se valida todo antes de tocar nada, igual que en una producción: descontar
  // la mitad de la lista y fallar en la otra deja el inventario peor de como
  // estaba, y sin saber cuál mitad se aplicó.
  const faltantes: string[] = [];
  for (const item of items) {
    const insumo = insumos.find((i) => i.id === item.insumoId);
    if (!insumo) return { success: false, error: "Uno de los insumos ya no existe." };
    if (item.cantidad > insumo.stockActual) {
      faltantes.push(
        `${insumo.nombre} (gastaste ${item.cantidad}, hay ${insumo.stockActual} ${insumo.unidad.toLowerCase()})`
      );
    }
  }

  if (faltantes.length > 0) {
    return {
      success: false,
      error: `No alcanza el stock registrado: ${faltantes.join("; ")}. Registra la compra que falta o corrige el conteo, y vuelve a intentar.`,
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const insumo = insumos.find((i) => i.id === item.insumoId)!;
        await tx.insumo.update({ where: { id: item.insumoId }, data: { stockActual: { decrement: item.cantidad } } });
        await tx.movimientoInsumo.create({
          data: {
            insumoId: item.insumoId,
            tipo: "SALIDA",
            cantidad: item.cantidad,
            costoUnitario: insumo.costoUnitario,
            motivo: notas?.trim() || "Consumo de desechables",
            createdById: userId,
            ...(fecha ? { createdAt: fecha } : {}),
          },
        });
      }
    }, { timeout: 30_000 });
  } catch (error) {
    console.error("Error al registrar consumo manual:", error);
    return { success: false, error: "No se pudo registrar el consumo. Intenta de nuevo." };
  }

  revalidatePath("/admin/inventario");
  revalidatePath("/admin/inventario/consumo");
  revalidatePath("/admin/inventario/resumen");
  return { success: true, data: { movimientos: items.length } };
}
