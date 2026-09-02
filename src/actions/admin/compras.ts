"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/auth";
import { redondearCosto, referenciaDesdeCosto } from "@/lib/costos";
import { MetodoPago } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session.user.id;
}

const compraItemSchema = z.object({
  insumoId: z.string(),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  // Sin .int(): un tarro de 3.000 g a $25.000 son $8,3333 por gramo, y forzarlo
  // a $8 desviaba el costo de cada receta que usara ese insumo.
  costoUnitario: z.coerce.number().min(0),
});

const compraSchema = z.object({
  proveedorId: z.string().min(1, "Elige un proveedor"),
  // Con qué se pagó. Es lo que permite que la compra baje de la plata real y no
  // solo suba el stock. EFECTIVO por defecto porque es como se le paga al 90%
  // de los proveedores de la plaza.
  metodoPago: z.nativeEnum(MetodoPago).default("EFECTIVO"),
  notas: z.string().optional(),
  // Opcional: sin fecha la compra queda con la de hoy. Se acepta para poder
  // registrar el domingo lo que se compró el sábado sin que caiga en el día
  // equivocado — y con eso, en el mes equivocado si se cruza fin de mes.
  fecha: z.string().optional(),
  items: z.array(compraItemSchema).min(1, "Agrega al menos un insumo a la compra"),
});

/**
 * "2026-08-20" de un <input type="date"> se interpretaría como medianoche UTC,
 * que en Colombia (UTC-5) cae el día anterior. Se ancla al mediodía local.
 */
function fechaLocal(iso?: string) {
  if (!iso) return undefined;
  const [anio, mes, dia] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return undefined;
  const d = new Date(anio, mes - 1, dia, 12, 0, 0);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Registra una compra completa (proveedor + líneas de insumo) en una sola
 * transacción: crea la Compra con sus CompraItem, suma el stock de cada
 * insumo, recalcula su costo promedio ponderado (mezclando lo que ya tenías
 * con lo nuevo) y deja un MovimientoInsumo tipo ENTRADA por cada línea,
 * reutilizando el mismo libro mayor de la Fase 1.
 *
 * No se puede eliminar una compra después de registrada (ver eliminarCompra
 * más abajo): es un comprobante histórico, y borrarlo dejaría el stock/costo
 * desincronizados con ventas que ya pudieron haber consumido ese insumo.
 */
export async function registrarCompra(input: unknown): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = compraSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { proveedorId, metodoPago, notas, items, fecha } = parsed.data;

  const insumoIds = [...new Set(items.map((i) => i.insumoId))];
  const insumosExistentes = await prisma.insumo.count({ where: { id: { in: insumoIds } } });
  if (insumosExistentes !== insumoIds.length) {
    return { success: false, error: "Uno de los insumos seleccionados ya no existe." };
  }

  // El total de la compra sí se redondea a peso: es la plata que se pagó.
  const total = Math.round(items.reduce((sum, item) => sum + item.cantidad * item.costoUnitario, 0));

  // Si la compra es de hoy y hay turno abierto, el pago al proveedor se anota
  // también como egreso de caja: así sale del arqueo del turno y queda quién,
  // cuándo y en cuál sesión, en vez de ser una resta invisible. Si no hay turno
  // —se compró en la plaza a las 6 a.m.— la compra igual descuenta el saldo,
  // pero por fuera de la caja (ver `salidasFueraDeCaja` en lib/saldos.ts).
  // OTRO nunca genera egreso: no es plata del cajón ni del Nequi.
  const fechaCompra = fechaLocal(fecha);
  const esDeHoy = !fechaCompra || fechaCompra.toDateString() === new Date().toDateString();
  const sesion =
    metodoPago !== "OTRO" && esDeHoy
      ? await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" }, select: { id: true, codigo: true } })
      : null;

  const proveedor = await prisma.proveedor.findUnique({ where: { id: proveedorId }, select: { nombre: true } });

  try {
    await prisma.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: {
          proveedorId,
          metodoPago,
          notas,
          total,
          ...(fechaCompra ? { fecha: fechaCompra } : {}),
          createdById: userId,
          items: { create: items.map((i) => ({ insumoId: i.insumoId, cantidad: i.cantidad, costoUnitario: i.costoUnitario })) },
        },
      });

      if (sesion) {
        await tx.movimientoCaja.create({
          data: {
            sesionId: sesion.id,
            tipo: "EGRESO",
            metodo: metodoPago,
            monto: total,
            concepto: `Compra a ${proveedor?.nombre ?? "proveedor"}`,
            compraId: compra.id,
            createdById: userId,
          },
        });
      }

      for (const item of items) {
        // Se relee dentro de la transacción (no del request original) para que,
        // si el mismo insumo aparece dos veces en la compra, el promedio
        // ponderado de la segunda línea ya considere la primera.
        const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: item.insumoId } });
        const nuevoStock = insumo.stockActual + item.cantidad;
        const nuevoCosto =
          nuevoStock > 0
            ? (insumo.stockActual * insumo.costoUnitario + item.cantidad * item.costoUnitario) / nuevoStock
            : item.costoUnitario;

        await tx.insumo.update({
          where: { id: item.insumoId },
          data: {
            stockActual: nuevoStock,
            // El promedio ponderado manda sobre el precio escrito a mano en
            // Insumos, así que se reescribe también el par precio/cantidad para
            // que ambas pantallas cuenten la misma historia.
            ...referenciaDesdeCosto(nuevoCosto, insumo.cantidadReferencia),
          },
        });
        await tx.movimientoInsumo.create({
          data: {
            insumoId: item.insumoId,
            tipo: "ENTRADA",
            cantidad: item.cantidad,
            costoUnitario: redondearCosto(item.costoUnitario),
            motivo: `Compra ${compra.id}`,
            createdById: userId,
          },
        });
      }
    });
  } catch {
    return { success: false, error: "No se pudo registrar la compra. Intenta de nuevo." };
  }

  revalidatePath("/admin/inventario");
  revalidatePath("/admin/inventario/compras");
  revalidatePath("/admin/inventario/recetas");
  revalidatePath("/admin/caja");
  revalidatePath("/admin/contabilidad");
  return {
    success: true,
    ...(metodoPago === "OTRO"
      ? {
          aviso:
            "Quedó registrada, pero pagada con “Otro” no descuenta ni del cajón ni del Nequi. Si salió de alguno de los dos, edítala al medio correcto.",
        }
      : sesion
        ? { aviso: `Se descontó del turno ${sesion.codigo} como egreso.` }
        : {
            aviso: esDeHoy
              ? "Se descontó del saldo, pero no hay caja abierta: el egreso no aparece en ningún turno."
              : "Se descontó del saldo. Como no es una compra de hoy, no se tocó la caja.",
          }),
  };
}
