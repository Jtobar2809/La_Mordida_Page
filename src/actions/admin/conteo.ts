"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/auth";
import { redondearCosto } from "@/lib/costos";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session.user.id;
}

function revalidar(id?: string) {
  revalidatePath("/admin/inventario/conteo");
  if (id) revalidatePath(`/admin/inventario/conteo/${id}`);
  revalidatePath("/admin/inventario");
  revalidatePath("/admin/inventario/mermas");
  revalidatePath("/admin/inventario/resumen");
  revalidatePath("/admin/contabilidad");
}

/**
 * Abre una toma de inventario congelando, para cada insumo activo, lo que el
 * sistema cree tener y cuánto vale. Ese congelado es lo que después permite
 * aplicar el conteo como diferencia en vez de como valor absoluto.
 */
export async function abrirConteo(): Promise<ActionResult<{ id: string }>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const abierto = await prisma.conteoInventario.findFirst({ where: { estado: "BORRADOR" } });
  if (abierto) {
    return { success: false, error: `Ya tienes el conteo ${abierto.codigo} sin terminar. Termina ese antes de abrir otro.` };
  }

  const insumos = await prisma.insumo.findMany({
    where: { activo: true },
    select: { id: true, stockActual: true, costoUnitario: true },
  });

  if (insumos.length === 0) return { success: false, error: "No hay insumos activos para contar." };

  const hoy = new Date();
  const sello = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}${String(hoy.getDate()).padStart(2, "0")}`;
  const delDia = await prisma.conteoInventario.count({ where: { codigo: { startsWith: `TI-${sello}` } } });
  const codigo = `TI-${sello}-${String(delDia + 1).padStart(2, "0")}`;

  const conteo = await prisma.conteoInventario.create({
    data: {
      codigo,
      createdById: userId,
      items: {
        create: insumos.map((i) => ({
          insumoId: i.id,
          stockSistema: i.stockActual,
          costoUnitario: i.costoUnitario,
        })),
      },
    },
  });

  revalidar(conteo.id);
  return { success: true, data: { id: conteo.id } };
}

const conteoItemSchema = z.object({
  itemId: z.string().min(1),
  // null explícito = "no conté este insumo", que no es lo mismo que contar 0.
  stockContado: z.union([z.coerce.number().min(0), z.null()]),
});

export async function guardarConteoItem(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = conteoItemSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const item = await prisma.conteoItem.findUnique({
    where: { id: parsed.data.itemId },
    include: { conteo: { select: { id: true, estado: true } } },
  });
  if (!item) return { success: false, error: "Esa línea ya no existe." };
  if (item.conteo.estado === "APLICADO") {
    return { success: false, error: "Este conteo ya se aplicó y no se puede editar." };
  }

  await prisma.conteoItem.update({
    where: { id: parsed.data.itemId },
    data: { stockContado: parsed.data.stockContado },
  });

  revalidar(item.conteo.id);
  return { success: true };
}

/**
 * Aplica el conteo: por cada insumo contado cuya cifra difiera de la congelada,
 * genera un AJUSTE por la DIFERENCIA sobre el stock actual.
 *
 * Aplicar la diferencia y no el valor contado es lo que hace que contar con el
 * negocio abierto sea seguro. Si el sistema decía 1.000, contaste 950, y
 * mientras tanto se vendieron 100, escribir `stock = 950` borraría esa venta;
 * aplicar −50 sobre los 900 que quedaron da 850, que es lo correcto.
 */
export async function aplicarConteo(conteoId: string): Promise<ActionResult<{ ajustes: number }>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const conteo = await prisma.conteoInventario.findUnique({
    where: { id: conteoId },
    include: { items: { include: { insumo: { select: { nombre: true } } } } },
  });

  if (!conteo) return { success: false, error: "Ese conteo no existe." };
  if (conteo.estado === "APLICADO") return { success: false, error: "Este conteo ya se aplicó." };

  const conDiferencia = conteo.items
    .filter((i) => i.stockContado !== null && i.stockContado !== i.stockSistema)
    .map((i) => ({
      insumoId: i.insumoId,
      nombre: i.insumo.nombre,
      delta: redondearCosto((i.stockContado as number) - i.stockSistema),
      costoUnitario: i.costoUnitario,
    }))
    .filter((i) => i.delta !== 0);

  const contados = conteo.items.filter((i) => i.stockContado !== null).length;
  if (contados === 0) {
    return { success: false, error: "No has contado ningún insumo todavía." };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const d of conDiferencia) {
          await tx.insumo.update({
            where: { id: d.insumoId },
            data: { stockActual: { increment: d.delta } },
          });
          await tx.movimientoInsumo.create({
            data: {
              insumoId: d.insumoId,
              tipo: "AJUSTE",
              cantidad: d.delta,
              costoUnitario: d.costoUnitario,
              motivo: `Toma de inventario ${conteo.codigo}`,
              conteoId: conteo.id,
              createdById: userId,
            },
          });
        }

        await tx.conteoInventario.update({
          where: { id: conteoId },
          data: { estado: "APLICADO", aplicadoAt: new Date() },
        });
      },
      { timeout: 30_000 }
    );
  } catch (error) {
    console.error("Error al aplicar el conteo:", error);
    return { success: false, error: "No se pudo aplicar el conteo. Intenta de nuevo." };
  }

  revalidar(conteoId);
  return { success: true, data: { ajustes: conDiferencia.length } };
}

export async function eliminarConteo(conteoId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const conteo = await prisma.conteoInventario.findUnique({ where: { id: conteoId }, select: { estado: true } });
  if (!conteo) return { success: false, error: "Ese conteo no existe." };
  // Un conteo aplicado ya movió el stock: borrarlo dejaría ajustes en el libro
  // mayor sin nada que los explique.
  if (conteo.estado === "APLICADO") {
    return { success: false, error: "Un conteo aplicado es un comprobante histórico y no se puede borrar." };
  }

  await prisma.conteoInventario.delete({ where: { id: conteoId } });
  revalidar();
  return { success: true };
}
