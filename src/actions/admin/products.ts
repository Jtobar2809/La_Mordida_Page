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
  return session;
}

/**
 * Un extra puede (y debería) declarar qué insumo consume y cuánto, para que al
 * venderlo el inventario baje solo. Los dos campos van juntos o no van: un
 * insumo sin cantidad no permite descontar nada, y una cantidad sin insumo no
 * apunta a ningún lado, así que se normalizan a null a la vez.
 */
const extraSchema = z
  .object({
    name: z.string().min(1),
    price: z.coerce.number().int().nonnegative(),
    insumoId: z.string().optional(),
    cantidadInsumo: z.coerce.number().positive().optional(),
  })
  .transform(({ insumoId, cantidadInsumo, ...resto }) => {
    const completo = Boolean(insumoId) && Boolean(cantidadInsumo);
    return {
      ...resto,
      insumoId: completo ? (insumoId as string) : null,
      cantidadInsumo: completo ? (cantidadInsumo as number) : null,
    };
  });

// Validación para CREAR un producto: todos los campos base son obligatorios.
const createProductSchema = z.object({
  id: z.undefined(),
  name: z.string().min(2),
  description: z.string().min(5),
  price: z.coerce.number().int().positive(),
  categoryId: z.string().min(1),
  image: z.string().optional(),
  ingredients: z.array(z.string()).default([]),
  extras: z.array(extraSchema).default([]),
  featured: z.boolean().default(false),
  available: z.boolean().default(true),
  spicyLevel: z.coerce.number().int().min(0).max(3).default(0),
  esCombo: z.boolean().default(false),
});

// Validación para EDITAR un producto existente: todo opcional. Solo lo
// que venga definido se valida y se actualiza; lo que no se incluya
// conserva su valor actual en la base de datos, sin necesidad de
// reenviar el formulario completo.
const updateProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  description: z.string().min(5).optional(),
  price: z.coerce.number().int().positive().optional(),
  categoryId: z.string().min(1).optional(),
  image: z.string().optional(),
  ingredients: z.array(z.string()).optional(),
  extras: z.array(extraSchema).optional(),
  featured: z.boolean().optional(),
  available: z.boolean().optional(),
  spicyLevel: z.coerce.number().int().min(0).max(3).optional(),
  esCombo: z.boolean().optional(),
});

const productSchema = z.union([createProductSchema, updateProductSchema]);

export async function upsertProduct(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, extras, ...data } = parsed.data;

  try {
    if (id) {
      // EDICIÓN: PATCH parcial. Solo los campos presentes en `data` se
      // incluyen en el update de Prisma — los que no se enviaron quedan
      // undefined y Prisma los omite del UPDATE, conservando el valor
      // actual en la base de datos sin necesidad de reenviarlo.
      const updateData: Record<string, unknown> = { ...data };
      if (data.name !== undefined) {
        updateData.slug = slugify(data.name);
      }

      await prisma.product.update({
        where: { id },
        data: updateData,
      });

      // Los extras solo se tocan si el formulario los incluyó explícitamente.
      // Si el campo no vino en el input, los extras existentes del
      // producto quedan exactamente como estaban.
      //
      // Se reconcilian POR NOMBRE en vez de borrarlos y recrearlos. Antes cada
      // guardado del producto le daba un ID nuevo a cada extra, y esos IDs son
      // referencias vivas en dos sitios: el carrito del cliente (localStorage)
      // y el JSON de extras de cada OrderItem. Al cambiar, el carrito de quien
      // estaba comprando perdía en silencio sus adicionales (no se cobraban ni
      // se descontaban), y ahora además se rompería el vínculo extra→insumo que
      // permite descontar inventario al vender un adicional.
      if (extras !== undefined) {
        const existentes = await prisma.productExtra.findMany({ where: { productId: id } });
        const porNombre = new Map(existentes.map((e) => [e.name.trim().toLowerCase(), e]));

        const conservados = new Set<string>();
        for (const extra of extras) {
          const previo = porNombre.get(extra.name.trim().toLowerCase());
          if (previo) {
            conservados.add(previo.id);
            await prisma.productExtra.update({ where: { id: previo.id }, data: extra });
          } else {
            const creado = await prisma.productExtra.create({ data: { ...extra, productId: id } });
            conservados.add(creado.id);
          }
        }

        // Los que el formulario ya no incluye sí se eliminan: dejar de ofrecer
        // un adicional es una decisión explícita del administrador.
        await prisma.productExtra.deleteMany({
          where: { productId: id, id: { notIn: [...conservados] } },
        });
      }
    } else {
      // CREACIÓN: aquí el schema ya garantizó que todos los campos
      // obligatorios están presentes.
      const createData = data as typeof data & { name: string; description: string; price: number; categoryId: string };
      const slug = slugify(createData.name);
      await prisma.product.create({
        data: { ...createData, slug, extras: { create: extras ?? [] } },
      });
    }
  } catch {
    return { success: false, error: "Ya existe un producto con un nombre muy similar." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/menu");
  revalidatePath("/");
  return { success: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.product.delete({ where: { id } });
  revalidatePath("/admin/productos");
  revalidatePath("/menu");
  return { success: true };
}

export async function toggleProductAvailability(id: string, available: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  await prisma.product.update({ where: { id }, data: { available } });
  revalidatePath("/admin/productos");
  revalidatePath("/menu");
  return { success: true };
}
