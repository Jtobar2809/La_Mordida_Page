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

const proveedorSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(2, "El nombre es muy corto"),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  activo: z.boolean().default(true),
});

export async function upsertProveedor(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = proveedorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, ...data } = parsed.data;

  try {
    if (id) {
      await prisma.proveedor.update({ where: { id }, data });
    } else {
      await prisma.proveedor.create({ data });
    }
  } catch {
    return { success: false, error: "Ya existe un proveedor con un nombre muy similar." };
  }

  revalidatePath("/admin/inventario/proveedores");
  revalidatePath("/admin/inventario/compras");
  revalidatePath("/admin/inventario");
  return { success: true };
}

export async function deleteProveedor(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const [comprasCount, insumosCount] = await Promise.all([
    prisma.compra.count({ where: { proveedorId: id } }),
    prisma.insumo.count({ where: { proveedorPrincipalId: id } }),
  ]);

  if (comprasCount > 0 || insumosCount > 0) {
    return {
      success: false,
      error: "No puedes eliminar un proveedor con compras registradas o insumos asignados. Desactívalo en su lugar (editar → Activo).",
    };
  }

  await prisma.proveedor.delete({ where: { id } });
  revalidatePath("/admin/inventario/proveedores");
  return { success: true };
}
