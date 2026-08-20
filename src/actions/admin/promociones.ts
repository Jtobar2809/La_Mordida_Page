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

const reglaSchema = z.object({
  productId: z.string().min(1),
  nombre: z.string().min(3, "Ponle un nombre a la promoción"),
  entregadas: z.coerce.number().int().positive(),
  pagadas: z.coerce.number().positive(),
  hasta: z.string().optional(),
});

/**
 * Activa una regla de cobro (2x1, 3x2…) para un producto.
 *
 * Se rechaza si el formato no descuenta nada o si regala de más: un "2x2" no
 * es promoción y un "1x2" cobraría el doble. Y se rechaza si el precio de la
 * promoción no cubre los insumos, porque el punto entero de esta pantalla es
 * que no se pueda activar una promoción que pierde plata en cada venta.
 */
export async function activarPromocion(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = reglaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { productId, nombre, entregadas, pagadas, hasta } = parsed.data;

  if (pagadas >= entregadas) {
    return { success: false, error: "Ese formato no descuenta nada: se paga por todas las unidades." };
  }

  const producto = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      recetaItems: { include: { insumo: { select: { costoUnitario: true } } } },
      comboItems: { include: { producto: { include: { recetaItems: { include: { insumo: { select: { costoUnitario: true } } } } } } } },
    },
  });
  if (!producto) return { success: false, error: "Ese producto ya no existe." };

  const { costoDeProducto } = await import("@/lib/costos");
  const costo = costoDeProducto(producto);
  if (costo <= 0) {
    return { success: false, error: `"${producto.name}" no tiene receta costeada, así que no se puede saber si la promoción pierde plata. Cuéstalo primero.` };
  }

  const contribucion = producto.price * pagadas - costo * entregadas;
  if (contribucion <= 0) {
    return {
      success: false,
      error: `Con un costo del ${Math.round((costo / producto.price) * 100)}%, ese formato pierde plata en cada venta. Aguanta hasta ${Math.round((pagadas / entregadas) * 100)}%.`,
    };
  }

  let vence: Date | null = null;
  if (hasta) {
    const [a, m, d] = hasta.split("-").map(Number);
    if (a && m && d) vence = new Date(a, m - 1, d, 23, 59, 59);
  }

  await prisma.promocionRegla.create({
    data: { productId, nombre, entregadas, pagadas, activa: true, hasta: vence },
  });

  revalidatePath("/admin/promociones");
  revalidatePath("/menu");
  return { success: true };
}

export async function desactivarPromocion(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  // Se borra en vez de marcarse inactiva: una regla apagada que nadie ve solo
  // sirve para reaparecer por accidente. Volver a activarla es un clic.
  await prisma.promocionRegla.delete({ where: { id } });
  revalidatePath("/admin/promociones");
  revalidatePath("/menu");
  return { success: true };
}
