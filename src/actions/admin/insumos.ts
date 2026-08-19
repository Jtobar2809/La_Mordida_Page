"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/auth";
import { MovimientoTipo, UnidadInsumo } from "@prisma/client";
import { costoPorUnidad, redondearCosto } from "@/lib/costos";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session.user.id;
}

const insumoSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(2, "El nombre es muy corto"),
  unidad: z.nativeEnum(UnidadInsumo),
  stockMinimo: z.coerce.number().min(0).default(0),
  // El precio se escribe como se compra: cuánto se pagó y por qué cantidad.
  // El costo por unidad sale de dividir, no se pide aparte — pedirlo obligaba a
  // sacar la calculadora para saber cuánto vale un gramo de mayonesa.
  precioReferencia: z.coerce.number().min(0, "El precio no puede ser negativo").default(0),
  cantidadReferencia: z.coerce.number().positive("La cantidad del precio debe ser mayor a 0").default(1),
  proveedor: z.string().optional(),
  proveedorPrincipalId: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  fechaVencimiento: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? new Date(v) : null)),
  esElaborado: z.boolean().default(false),
  activo: z.boolean().default(true),
});

export async function upsertInsumo(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = insumoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, ...campos } = parsed.data;

  // costoUnitario es siempre derivado: nunca se escribe a mano en ningún lado.
  // Así el precio tiene un solo dueño (esta pantalla) y recetas/composiciones
  // solo lo leen.
  const data = {
    ...campos,
    precioReferencia: redondearCosto(campos.precioReferencia),
    costoUnitario: costoPorUnidad(campos.precioReferencia, campos.cantidadReferencia),
  };

  try {
    if (id) {
      // El stock actual NUNCA se edita directo aquí: solo cambia vía registrarMovimiento,
      // para que quede siempre un registro trazable en MovimientoInsumo.
      await prisma.insumo.update({ where: { id }, data });
      revalidatePath("/admin/inventario");
      revalidatePath("/admin/inventario/recetas");
      revalidatePath("/admin/inventario/produccion");
      revalidatePath("/admin/inventario/resumen");
      return { success: true, data: { id } };
    } else {
      const creado = await prisma.insumo.create({ data: { ...data, stockActual: 0 } });
      revalidatePath("/admin/inventario");
      revalidatePath("/admin/inventario/recetas");
      return { success: true, data: { id: creado.id } };
    }
  } catch {
    return { success: false, error: "Ya existe un insumo con un nombre muy similar." };
  }
}

export async function deleteInsumo(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  // Dos usos posibles que bloquean el borrado a nivel de base de datos
  // (onDelete: Restrict): que esté en la receta de un producto, o que sea
  // componente de otro insumo elaborado. Sin este chequeo, prisma.insumo.delete
  // lanza un error crudo de restricción en vez de un mensaje entendible.
  const [enRecetas, enComposiciones] = await Promise.all([
    prisma.recetaItem.count({ where: { insumoId: id } }),
    prisma.insumoComponente.count({ where: { insumoBaseId: id } }),
  ]);

  if (enRecetas > 0) {
    return { success: false, error: "No puedes eliminar un insumo que está usado en una o más recetas. Quítalo de esas recetas primero." };
  }
  if (enComposiciones > 0) {
    return { success: false, error: "No puedes eliminar un insumo que es componente de otro insumo elaborado. Quítalo de esa composición primero." };
  }

  await prisma.insumo.delete({ where: { id } });
  revalidatePath("/admin/inventario");
  return { success: true };
}

const movimientoSchema = z
  .object({
    insumoId: z.string(),
    tipo: z.nativeEnum(MovimientoTipo),
    cantidad: z.coerce.number(),
    motivo: z.string().optional(),
  })
  .refine((data) => data.tipo === "AJUSTE" || data.cantidad > 0, {
    message: "La cantidad debe ser mayor a 0",
    path: ["cantidad"],
  });

export async function registrarMovimiento(input: unknown): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = movimientoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { insumoId, tipo, cantidad, motivo } = parsed.data;

  const insumo = await prisma.insumo.findUnique({ where: { id: insumoId } });
  if (!insumo) return { success: false, error: "Insumo no encontrado" };

  // ENTRADA suma, SALIDA y MERMA siempre restan (sin importar el signo que escriban),
  // AJUSTE respeta el signo tal cual se ingresa (puede corregir hacia arriba o abajo).
  const delta = tipo === "SALIDA" || tipo === "MERMA" ? -Math.abs(cantidad) : cantidad;
  const nuevoStock = insumo.stockActual + delta;

  if (nuevoStock < 0) {
    return { success: false, error: `Stock insuficiente. Disponible: ${insumo.stockActual} (${insumo.unidad.toLowerCase()}).` };
  }

  await prisma.$transaction([
    prisma.insumo.update({ where: { id: insumoId }, data: { stockActual: nuevoStock } }),
    prisma.movimientoInsumo.create({
      data: { insumoId, tipo, cantidad, motivo, createdById: userId, costoUnitario: insumo.costoUnitario },
    }),
  ]);

  revalidatePath("/admin/inventario");
  return { success: true };
}
