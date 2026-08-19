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

const produccionSchema = z.object({
  insumoElaboradoId: z.string().min(1, "Elige qué insumo se preparó"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  notas: z.string().max(300).optional(),
});

/**
 * Registra un lote preparado en cocina: suma stock del insumo elaborado y
 * descuenta sus componentes según `InsumoComponente`, todo en una transacción.
 *
 * Este era el eslabón que faltaba en el inventario. La composición de los
 * elaborados ya existía en la base de datos, pero nada la ejecutaba: el aderezo
 * bajaba de stock cada vez que se vendía una hamburguesa y la mayonesa que lo
 * compone no bajaba nunca, así que el sistema creía tener mayonesa infinita y
 * el aderezo se iba a negativo sin que ninguna compra explicara la diferencia.
 *
 * El costo del elaborado NO se toma de una tabla de precios: se calcula con lo
 * que costaron realmente los componentes de ESTE lote y se promedia contra el
 * stock que ya había, igual que hace `registrarCompra` con las compras. Así el
 * costo de una hamburguesa refleja lo que de verdad costó hacerla.
 */
export async function registrarProduccion(input: unknown): Promise<ActionResult<{ id: string }>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = produccionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { insumoElaboradoId, cantidad, notas } = parsed.data;

  const elaborado = await prisma.insumo.findUnique({
    where: { id: insumoElaboradoId },
    include: { composicion: { include: { insumoBase: true } } },
  });

  if (!elaborado) return { success: false, error: "Ese insumo no existe." };
  if (!elaborado.esElaborado) {
    return { success: false, error: `"${elaborado.nombre}" no está marcado como elaborado. Si se prepara en cocina, edítalo y actívale esa opción.` };
  }
  if (elaborado.composicion.length === 0) {
    return { success: false, error: `Primero define de qué está hecho "${elaborado.nombre}" en su composición.` };
  }

  // Se valida TODO el stock antes de tocar nada: si falta un solo componente,
  // no tiene sentido descontar los otros para una preparación que no se hizo.
  const requerimientos = elaborado.composicion.map((c) => ({
    insumoId: c.insumoBaseId,
    nombre: c.insumoBase.nombre,
    unidad: c.insumoBase.unidad,
    disponible: c.insumoBase.stockActual,
    costoUnitario: c.insumoBase.costoUnitario,
    necesario: c.cantidad * cantidad,
  }));

  const faltantes = requerimientos.filter((r) => r.necesario > r.disponible);
  if (faltantes.length > 0) {
    const detalle = faltantes
      .map((f) => `${f.nombre} (necesitas ${redondear(f.necesario)}, tienes ${redondear(f.disponible)} ${f.unidad.toLowerCase()})`)
      .join("; ");
    return { success: false, error: `No alcanza el inventario para preparar eso: ${detalle}.` };
  }

  const costoTotalLote = requerimientos.reduce((sum, r) => sum + r.necesario * r.costoUnitario, 0);
  const costoUnitarioLote = Math.round(costoTotalLote / cantidad);

  try {
    const produccion = await prisma.$transaction(
      async (tx) => {
        const registro = await tx.produccion.create({
          data: { insumoElaboradoId, cantidad, costoUnitario: costoUnitarioLote, notas: notas?.trim() || null, createdById: userId },
        });

        for (const r of requerimientos) {
          await tx.insumo.update({ where: { id: r.insumoId }, data: { stockActual: { decrement: r.necesario } } });
          await tx.movimientoInsumo.create({
            data: {
              insumoId: r.insumoId,
              tipo: "SALIDA",
              cantidad: r.necesario,
              costoUnitario: r.costoUnitario,
              motivo: `Consumido preparando ${elaborado.nombre}`,
              produccionId: registro.id,
              createdById: userId,
            },
          });
        }

        // Costo promedio ponderado del elaborado: mezcla lo que ya había en
        // stock con lo que acaba de salir de la olla.
        const nuevoStock = elaborado.stockActual + cantidad;
        const nuevoCosto =
          nuevoStock > 0
            ? Math.round((elaborado.stockActual * elaborado.costoUnitario + cantidad * costoUnitarioLote) / nuevoStock)
            : costoUnitarioLote;

        await tx.insumo.update({
          where: { id: insumoElaboradoId },
          data: { stockActual: nuevoStock, costoUnitario: nuevoCosto },
        });
        await tx.movimientoInsumo.create({
          data: {
            insumoId: insumoElaboradoId,
            tipo: "PRODUCCION",
            cantidad,
            costoUnitario: costoUnitarioLote,
            motivo: `Preparación de ${elaborado.nombre}`,
            produccionId: registro.id,
            createdById: userId,
          },
        });

        return registro;
      },
      { timeout: 20_000 }
    );

    revalidatePath("/admin/inventario");
    revalidatePath("/admin/inventario/produccion");
    revalidatePath("/admin/inventario/resumen");
    return { success: true, data: { id: produccion.id } };
  } catch (error) {
    console.error("Error al registrar producción:", error);
    return { success: false, error: "No se pudo registrar la preparación. Intenta de nuevo." };
  }
}

/**
 * Cuánto se puede preparar de un elaborado con el stock que hay hoy. Lo usa la
 * pantalla de producción para avisar antes de que el usuario escriba un número
 * imposible, en vez de dejarlo llenar el formulario y fallar al guardar.
 */
export async function calcularMaximoProducible(insumoElaboradoId: string): Promise<number> {
  const elaborado = await prisma.insumo.findUnique({
    where: { id: insumoElaboradoId },
    include: { composicion: { include: { insumoBase: true } } },
  });

  if (!elaborado || elaborado.composicion.length === 0) return 0;

  return Math.min(
    ...elaborado.composicion.map((c) => (c.cantidad > 0 ? c.insumoBase.stockActual / c.cantidad : Infinity))
  );
}

function redondear(n: number) {
  return Math.round(n * 100) / 100;
}
