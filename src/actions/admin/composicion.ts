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

/**
 * Ahora un insumo elaborado SÍ puede tener como componente a otro insumo
 * elaborado (ej. un combo que lleva una salsa que a su vez es una mezcla de
 * otros insumos). Para que eso no forme una dependencia circular (A lleva B,
 * B lleva A), antes de agregar insumoBaseId como componente de
 * insumoElaboradoId recorremos el árbol de composición de insumoBaseId hacia
 * abajo: si en algún punto aparece insumoElaboradoId, agregarlo crearía un
 * ciclo y lo rechazamos.
 */
async function creariaCiclo(insumoElaboradoId: string, insumoBaseId: string): Promise<boolean> {
  const visitados = new Set<string>();
  const pendientes = [insumoBaseId];

  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    if (actual === insumoElaboradoId) return true;
    if (visitados.has(actual)) continue;
    visitados.add(actual);

    const hijos = await prisma.insumoComponente.findMany({
      where: { insumoElaboradoId: actual },
      select: { insumoBaseId: true },
    });
    for (const h of hijos) pendientes.push(h.insumoBaseId);
  }

  return false;
}

/**
 * Costo de un insumo, resuelto recursivamente si es elaborado: en vez de
 * confiar en el costoUnitario guardado (que puede estar desactualizado si no
 * le diste "Usar como costo del insumo" después de tocar su composición),
 * lo recalcula sumando cantidad × costo de cada componente, bajando tantos
 * niveles como haga falta. `enProceso` protege contra un ciclo inesperado en
 * datos ya existentes (no debería pasar gracias a creariaCiclo, pero si pasa,
 * cortamos en vez de colgar la función).
 */
async function calcularCostoInsumo(
  insumoId: string,
  cache: Map<string, number>,
  enProceso: Set<string>
): Promise<number> {
  if (cache.has(insumoId)) return cache.get(insumoId)!;
  if (enProceso.has(insumoId)) return 0;
  enProceso.add(insumoId);

  const insumo = await prisma.insumo.findUnique({ where: { id: insumoId }, select: { costoUnitario: true, esElaborado: true } });
  if (!insumo) {
    enProceso.delete(insumoId);
    return 0;
  }

  if (!insumo.esElaborado) {
    enProceso.delete(insumoId);
    cache.set(insumoId, insumo.costoUnitario);
    return insumo.costoUnitario;
  }

  const componentes = await prisma.insumoComponente.findMany({
    where: { insumoElaboradoId: insumoId },
    select: { cantidad: true, insumoBaseId: true },
  });

  if (componentes.length === 0) {
    // Elaborado pero sin composición definida todavía: se respeta el costo manual.
    enProceso.delete(insumoId);
    cache.set(insumoId, insumo.costoUnitario);
    return insumo.costoUnitario;
  }

  let total = 0;
  for (const c of componentes) {
    total += c.cantidad * (await calcularCostoInsumo(c.insumoBaseId, cache, enProceso));
  }

  const redondeado = Math.round(total);
  enProceso.delete(insumoId);
  cache.set(insumoId, redondeado);
  return redondeado;
}

const componenteSchema = z.object({
  id: z.string().optional(),
  insumoElaboradoId: z.string(),
  insumoBaseId: z.string(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
});

export async function upsertComponente(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = componenteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, insumoElaboradoId, insumoBaseId, cantidad } = parsed.data;

  if (insumoElaboradoId === insumoBaseId) {
    return { success: false, error: "Un insumo no puede ser componente de sí mismo." };
  }

  if (!id && (await creariaCiclo(insumoElaboradoId, insumoBaseId))) {
    return {
      success: false,
      error: "Eso crearía una dependencia circular: uno de esos insumos ya depende (directa o indirectamente) del otro.",
    };
  }

  try {
    if (id) {
      await prisma.insumoComponente.update({ where: { id }, data: { cantidad } });
    } else {
      await prisma.insumoComponente.create({ data: { insumoElaboradoId, insumoBaseId, cantidad } });
    }
  } catch {
    return { success: false, error: "Ese insumo ya está en la composición. Edita la cantidad existente." };
  }

  revalidatePath("/admin/inventario");
  return { success: true };
}

export async function deleteComponente(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.insumoComponente.delete({ where: { id } });
  revalidatePath("/admin/inventario");
  return { success: true };
}

/**
 * Recalcula el costoUnitario del insumo elaborado a partir de su composición
 * (cantidad × costo de cada componente, recursivo si un componente es a su
 * vez elaborado — ver calcularCostoInsumo). Como `cantidad` está definida
 * "por cada 1 [unidad del elaborado]", el resultado ya es el costo por
 * unidad — no hay que dividir por ningún rendimiento de lote.
 */
export async function recalcularCostoElaborado(insumoId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const totalComponentes = await prisma.insumoComponente.count({ where: { insumoElaboradoId: insumoId } });
  if (totalComponentes === 0) {
    return { success: false, error: "Este insumo todavía no tiene componentes definidos." };
  }

  // Recursivo: si algún componente es a su vez un insumo elaborado, su costo
  // también se recalcula desde su propia composición — no hace falta que
  // recalcules manualmente de abajo hacia arriba en un orden específico.
  const nuevoCosto = await calcularCostoInsumo(insumoId, new Map(), new Set());

  await prisma.insumo.update({ where: { id: insumoId }, data: { costoUnitario: nuevoCosto } });

  revalidatePath("/admin/inventario");
  revalidatePath("/admin/inventario/recetas");
  return { success: true };
}
