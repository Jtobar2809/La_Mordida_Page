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

const compraItemSchema = z.object({
  insumoId: z.string(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  costoUnitario: z.coerce.number().int().min(0),
});

const compraSchema = z.object({
  proveedorId: z.string().min(1, "Elige un proveedor"),
  notas: z.string().optional(),
  items: z.array(compraItemSchema).min(1, "Agrega al menos un insumo a la compra"),
});

/**
 * Registra una compra completa (proveedor + líneas de insumo) en una sola
 * transacción: crea la Compra con sus CompraItem, suma el stock de cada
 * insumo, recalcula su costo promedio ponderado (mezclando lo que ya tenías
 * con lo nuevo) y deja un MovimientoInsumo tipo ENTRADA por cada línea,
 * reutilizando el mismo libro mayor de la Fase 1.
 *
 * No se puede eliminar una compra después de registrada (ver eliminarCompra
 * más abajo): es un comprobante histórico, y borrarlo dejaría el stock/costo
 * desincronizados con ventas que ya pudieron haber consumido ese insumo.
 */
export async function registrarCompra(input: unknown): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = compraSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { proveedorId, notas, items } = parsed.data;

  const insumoIds = [...new Set(items.map((i) => i.insumoId))];
  const insumosExistentes = await prisma.insumo.count({ where: { id: { in: insumoIds } } });
  if (insumosExistentes !== insumoIds.length) {
    return { success: false, error: "Uno de los insumos seleccionados ya no existe." };
  }

  const total = items.reduce((sum, item) => sum + item.cantidad * item.costoUnitario, 0);

  try {
    await prisma.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: {
          proveedorId,
          notas,
          total,
          createdById: userId,
          items: { create: items.map((i) => ({ insumoId: i.insumoId, cantidad: i.cantidad, costoUnitario: i.costoUnitario })) },
        },
      });

      for (const item of items) {
        // Se relee dentro de la transacción (no del request original) para que,
        // si el mismo insumo aparece dos veces en la compra, el promedio
        // ponderado de la segunda línea ya considere la primera.
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: item.insumoId } });
        const nuevoStock = insumo.stockActual + item.cantidad;
        const nuevoCosto =
          nuevoStock > 0
            ? Math.round((insumo.stockActual * insumo.costoUnitario + item.cantidad * item.costoUnitario) / nuevoStock)
            : item.costoUnitario;

        await tx.insumo.update({ where: { id: item.insumoId }, data: { stockActual: nuevoStock, costoUnitario: nuevoCosto } });
        await tx.movimientoInsumo.create({
          data: {
            insumoId: item.insumoId,
            tipo: "ENTRADA",
            cantidad: item.cantidad,
            costoUnitario: item.costoUnitario,
            motivo: `Compra ${compra.id}`,
            createdById: userId,
          },
        });
      }
    });
  } catch {
    return { success: false, error: "No se pudo registrar la compra. Intenta de nuevo." };
  }

  revalidatePath("/admin/inventario");
  revalidatePath("/admin/inventario/compras");
  revalidatePath("/admin/inventario/recetas");
  return { success: true };
}
