"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setSetting } from "@/lib/settings";
import { inicioDeMes } from "@/lib/costos-fijos";
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
  // Cambiar un fijo cambia la utilidad del mes y el cupo de retiros.
  revalidatePath("/admin/contabilidad");
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

  // Todo cambio de vigencia se ancla al día 1 del mes en curso: el arriendo se
  // paga entero, así que el mes en que sube ya cuenta el monto nuevo y no una
  // mezcla prorrateada de los dos.
  const corte = inicioDeMes(new Date());

  try {
    // Alta: la vigencia arranca este mes.
    if (!id) {
      if (await nombreYaVigente(data.nombre)) {
        return { success: false, error: "Ya hay un gasto fijo vigente con ese nombre." };
      }
      const creado = await prisma.costoFijo.create({
        data: { ...data, vigenteDesde: corte, vigenteHasta: data.activo ? null : corte },
      });
      revalidar();
      return { success: true, data: { id: creado.id } };
    }

    const actual = await prisma.costoFijo.findUnique({ where: { id } });
    if (!actual) return { success: false, error: "Ese gasto fijo ya no existe." };

    if (data.nombre !== actual.nombre && (await nombreYaVigente(data.nombre, id))) {
      return { success: false, error: "Ya hay un gasto fijo vigente con ese nombre." };
    }

    // Dar de baja: no se borra ni se reescribe, se cierra la vigencia. Los
    // meses en que sí se pagó lo siguen contando.
    if (!data.activo) {
      const cerrado = await prisma.costoFijo.update({
        where: { id },
        data: { ...data, vigenteHasta: actual.vigenteHasta ?? corte },
      });
      revalidar();
      return { success: true, data: { id: cerrado.id } };
    }

    // El monto es lo único que reescribe la historia si se edita en el sitio.
    // Si cambió y la fila ya vivió meses anteriores, se versiona: se cierra la
    // vieja el día 1 y se abre una nueva desde ese mismo día 1. `vigenteHasta`
    // es exclusivo, así que el mes del cambio cuenta la nueva y solo la nueva.
    const montoCambio = data.monto !== actual.monto;
    const yaTieneHistoria = actual.vigenteDesde < corte;

    if (montoCambio && yaTieneHistoria) {
      const nueva = await prisma.$transaction(async (tx) => {
        await tx.costoFijo.update({
          where: { id },
          data: { activo: false, vigenteHasta: corte },
        });
        return tx.costoFijo.create({
          data: { ...data, vigenteDesde: corte, vigenteHasta: null },
        });
      });
      revalidar();
      return { success: true, data: { id: nueva.id } };
    }

    // Mismo mes o sin cambio de monto: no hay período cerrado que proteger.
    const guardado = await prisma.costoFijo.update({
      where: { id },
      data: { ...data, vigenteHasta: null },
    });
    revalidar();
    return { success: true, data: { id: guardado.id } };
  } catch {
    return { success: false, error: "No se pudo guardar el gasto fijo. Intenta de nuevo." };
  }
}

/**
 * `nombre` dejó de ser único en la base porque "Arriendo" existe una vez por
 * cada monto que tuvo. Lo que no puede repetirse es un nombre VIGENTE, y eso
 * solo se sabe aquí.
 */
async function nombreYaVigente(nombre: string, exceptoId?: string) {
  const choque = await prisma.costoFijo.findFirst({
    where: {
      nombre,
      vigenteHasta: null,
      ...(exceptoId ? { id: { not: exceptoId } } : {}),
    },
    select: { id: true },
  });
  return choque !== null;
}

export async function deleteCostoFijo(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  // Solo se puede borrar de verdad un costo que nunca alcanzó a contar en un
  // mes cerrado. Para el resto la baja correcta es cerrar la vigencia
  // (`activo: false`), que es lo que deja enero diciendo lo que decía en enero.
  const costo = await prisma.costoFijo.findUnique({ where: { id } });
  if (!costo) return { success: false, error: "Ese gasto fijo ya no existe." };

  const corte = inicioDeMes(new Date());
  if (costo.vigenteDesde < corte) {
    await prisma.costoFijo.update({
      where: { id },
      data: { activo: false, vigenteHasta: costo.vigenteHasta ?? corte },
    });
    revalidar();
    return {
      success: false,
      error:
        "Este gasto ya contó en meses cerrados, así que no se borra: quedó dado de baja desde este mes y los meses anteriores lo siguen mostrando.",
    };
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
