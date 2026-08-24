"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/auth";
import { GastoCategoria, MetodoPago } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session.user.id;
}

const gastoSchema = z.object({
  id: z.string().optional(),
  fecha: z.string().min(1, "Elige la fecha"),
  concepto: z.string().min(2, "Escribe de qué fue el gasto"),
  monto: z.coerce.number().int().positive("El monto debe ser mayor a 0"),
  categoria: z.nativeEnum(GastoCategoria).default("OTRO"),
  metodoPago: z.nativeEnum(MetodoPago).default("EFECTIVO"),
  notas: z.string().max(300).optional(),
});

export async function upsertGasto(input: unknown): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = gastoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { id, fecha, ...resto } = parsed.data;
  // La fecha llega como "2026-08-20" de un <input type="date">. Interpretarla
  // directo la trataría como medianoche UTC y en Colombia (UTC-5) caería el día
  // anterior, mandando el gasto al mes pasado cuando se registra un día 1.
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const fechaLocal = new Date(anio ?? 1970, (mes ?? 1) - 1, dia ?? 1, 12, 0, 0);
  if (Number.isNaN(fechaLocal.getTime())) return { success: false, error: "La fecha no es válida" };

  const data = { ...resto, fecha: fechaLocal };

  if (id) {
    // Un gasto que nació de un egreso de caja no se puede editar aquí: cambiar
    // el monto dejaría el arqueo de ese turno diciendo una cifra y la
    // contabilidad otra, que es exactamente el descuadre que el vínculo entre
    // los dos libros vino a cerrar.
    const existente = await prisma.gasto.findUnique({
      where: { id },
      include: { movimientoCaja: { select: { id: true, monto: true, metodo: true, sesion: { select: { codigo: true } } } } },
    });
    if (!existente) return { success: false, error: "Ese gasto ya no existe." };

    const ligado = existente.movimientoCaja;
    if (ligado && (data.monto !== ligado.monto || data.metodoPago !== ligado.metodo)) {
      return {
        success: false,
        error: `Este gasto salió de la caja (turno ${ligado.sesion.codigo}). Puedes corregir el concepto o la categoría, pero el monto y el medio de pago se arreglan en la caja para que el arqueo no quede mintiendo.`,
      };
    }

    await prisma.gasto.update({ where: { id }, data });
    revalidatePath("/admin/contabilidad");
    revalidatePath("/admin/caja");
    return { success: true };
  }

  // Un gasto en efectivo saca plata del cajón de verdad. Si hay un turno
  // abierto y el gasto es de hoy, se registra también el egreso: sin eso, el
  // turno cerraba con un faltante exactamente igual al gasto y nadie sabía de
  // dónde salía.
  const hoy = new Date();
  const esDeHoy = fechaLocal.toDateString() === hoy.toDateString();
  const sesion =
    data.metodoPago === "EFECTIVO" && esDeHoy
      ? await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" }, select: { id: true, codigo: true } })
      : null;

  await prisma.$transaction(async (tx) => {
    const gasto = await tx.gasto.create({ data: { ...data, createdById: userId } });
    if (sesion) {
      await tx.movimientoCaja.create({
        data: {
          sesionId: sesion.id,
          tipo: "EGRESO",
          metodo: "EFECTIVO",
          monto: data.monto,
          concepto: data.concepto,
          gastoId: gasto.id,
          createdById: userId,
        },
      });
    }
  });

  revalidatePath("/admin/contabilidad");
  revalidatePath("/admin/caja");
  return {
    success: true,
    ...(data.metodoPago === "EFECTIVO" && !sesion
      ? {
          aviso: esDeHoy
            ? "Quedó anotado en contabilidad, pero no hay caja abierta: si esa plata salió del cajón, registra el egreso cuando abras el turno o el arqueo va a mostrar un faltante."
            : "Quedó anotado en contabilidad. Como no es un gasto de hoy, no se tocó la caja.",
        }
      : {}),
  };
}

export async function deleteGasto(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  // Si el gasto salió de la caja, el egreso NO se borra: la plata sí salió del
  // cajón y borrarlo dejaría ese turno sin cuadrar. Se corta el vínculo y el
  // movimiento queda como lo que es, plata que salió sin gasto asociado.
  const ligado = await prisma.gasto.findUnique({
    where: { id },
    include: { movimientoCaja: { select: { sesion: { select: { codigo: true } } } } },
  });
  if (!ligado) return { success: false, error: "Ese gasto ya no existe." };

  await prisma.gasto.delete({ where: { id } });
  revalidatePath("/admin/contabilidad");
  revalidatePath("/admin/caja");

  return {
    success: true,
    ...(ligado.movimientoCaja
      ? {
          aviso: `El gasto se borró, pero el egreso del turno ${ligado.movimientoCaja.sesion.codigo} sigue ahí: esa plata sí salió del cajón y quitarla descuadraría el arqueo.`,
        }
      : {}),
  };
}
