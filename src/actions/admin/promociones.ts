"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/actions/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
}

const crearSchema = z.object({
  nombre: z.string().min(3, "Ponle un nombre al combo"),
  descripcion: z.string().min(5, "Escribe una descripción corta"),
  precio: z.coerce.number().int().positive("El precio debe ser mayor a 0"),
  categoriaId: z.string().min(1, "Elige una categoría"),
  productoIds: z.array(z.string().min(1)).min(2, "Un combo necesita al menos dos productos"),
  /** Solo se publica en la carta cuando la persona lo decide. */
  disponible: z.boolean().default(false),
});

/**
 * Convierte una sugerencia del generador en un combo real del menú.
 *
 * El combo nace NO disponible a propósito: crearlo desde una tabla de análisis
 * es un experimento, y un experimento no debería aparecerle al cliente antes de
 * que alguien le ponga foto, revise el nombre y confirme el precio. Se publica
 * después desde Productos.
 */
export async function crearComboDesdeSugerencia(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = crearSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { nombre, descripcion, precio, categoriaId, productoIds, disponible } = parsed.data;

  // Un combo no puede contener otro combo: la regla la impone el modelo, y sin
  // este chequeo el error saldría como una violación de restricción cruda.
  const componentes = await prisma.product.findMany({
    where: { id: { in: productoIds } },
    select: { id: true, name: true, esCombo: true },
  });
  if (componentes.length !== productoIds.length) {
    return { success: false, error: "Alguno de los productos ya no existe." };
  }
  const combo = componentes.find((c) => c.esCombo);
  if (combo) {
    return { success: false, error: `"${combo.name}" ya es un combo, y un combo no puede llevar otro adentro.` };
  }

  // Cuántas veces aparece cada producto: un combo de dos hamburguesas iguales
  // sería un solo ComboItem con cantidad 2, no dos filas (la clave única
  // (comboId, productoId) lo rechazaría).
  const cantidades = new Map<string, number>();
  for (const id of productoIds) cantidades.set(id, (cantidades.get(id) ?? 0) + 1);

  try {
    const creado = await prisma.product.create({
      data: {
        name: nombre,
        slug: slugify(nombre),
        description: descripcion,
        price: precio,
        categoryId: categoriaId,
        ingredients: [],
        esCombo: true,
        available: disponible,
        comboItems: {
          create: [...cantidades].map(([productoId, cantidad]) => ({ productoId, cantidad })),
        },
      },
    });

    revalidatePath("/admin/promociones");
    revalidatePath("/admin/productos");
    revalidatePath("/admin/inventario/recetas");
    revalidatePath("/menu");
    return { success: true, data: { id: creado.id } };
  } catch {
    return { success: false, error: "Ya existe un producto con ese nombre. Cámbiale el nombre al combo." };
  }
}
