"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { priceOrderItems } from "@/lib/pricing";
import { descontarInventarioPorOrden, revertirInventarioPorOrden } from "@/lib/inventario";
import { calcularResumenCaja, generarCodigoSesion, EMAIL_CLIENTE_MOSTRADOR } from "@/lib/caja";
import { obtenerCupoDelMesActual } from "@/lib/retiros";
import { formatCOP } from "@/lib/utils";
import type { ActionResult } from "@/actions/auth";
import { MetodoPago } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session.user.id;
}

function revalidarCaja() {
  revalidatePath("/admin/caja");
  revalidatePath("/admin/caja/sesiones");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/inventario");
  // Los retiros de socios salen del cajón pero se leen en contabilidad, donde
  // se comparan contra el cupo del mes.
  revalidatePath("/admin/contabilidad");
}

async function obtenerClienteMostrador() {
  const existente = await prisma.user.findUnique({ where: { email: EMAIL_CLIENTE_MOSTRADOR } });
  if (existente) return existente;

  return prisma.user.create({
    data: { name: "Cliente de mostrador", email: EMAIL_CLIENTE_MOSTRADOR, role: "CLIENTE" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Apertura y cierre del turno
// ─────────────────────────────────────────────────────────────────────────────

const abrirCajaSchema = z.object({
  montoInicial: z.coerce.number().int().min(0, "La base no puede ser negativa"),
  notas: z.string().max(300).optional(),
});

export async function abrirCaja(input: unknown): Promise<ActionResult<{ id: string; codigo: string }>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = abrirCajaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const sesion = await prisma.cajaSesion.create({
      data: {
        codigo: await generarCodigoSesion(),
        montoInicial: parsed.data.montoInicial,
        notasApertura: parsed.data.notas?.trim() || null,
        abiertaPorId: userId,
        abiertaLock: true,
      },
    });

    revalidarCaja();
    return { success: true, data: { id: sesion.id, codigo: sesion.codigo } };
  } catch {
    // El único error esperable aquí es la violación del índice único
    // `abiertaLock`: alguien ya abrió caja (posiblemente en otro dispositivo)
    // entre que se pintó la pantalla y se hizo clic.
    return { success: false, error: "Ya hay una caja abierta. Ciérrala antes de abrir un turno nuevo." };
  }
}

const cerrarCajaSchema = z.object({
  efectivoContado: z.coerce.number().int().min(0, "El efectivo contado no puede ser negativo"),
  notas: z.string().max(500).optional(),
});

/**
 * Cierra el turno: congela el arqueo y suelta el `abiertaLock` para que se
 * pueda abrir el siguiente. Todo dentro de una transacción con la condición
 * `estado: ABIERTA` en el WHERE, así que dos cierres simultáneos no pueden
 * escribir dos snapshots distintos del mismo turno.
 */
export async function cerrarCaja(input: unknown): Promise<ActionResult<{ diferencia: number }>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = cerrarCajaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const sesion = await prisma.cajaSesion.findFirst({
    where: { estado: "ABIERTA" },
    include: { movimientos: true },
  });
  if (!sesion) return { success: false, error: "No hay ninguna caja abierta." };

  const resumen = calcularResumenCaja(sesion.montoInicial, sesion.movimientos);
  const diferencia = parsed.data.efectivoContado - resumen.esperadoEfectivo;

  const actualizadas = await prisma.cajaSesion.updateMany({
    where: { id: sesion.id, estado: "ABIERTA" },
    data: {
      estado: "CERRADA",
      cerradaPorId: userId,
      cerradaAt: new Date(),
      notasCierre: parsed.data.notas?.trim() || null,
      efectivoContado: parsed.data.efectivoContado,
      totalVentas: resumen.totalVentas,
      totalEfectivo: resumen.totalEfectivo,
      totalNequi: resumen.totalNequi,
      totalOtros: resumen.totalOtros,
      totalIngresos: resumen.totalIngresos,
      totalEgresos: resumen.totalEgresos,
      totalRetiros: resumen.totalRetiros,
      esperadoEfectivo: resumen.esperadoEfectivo,
      diferencia,
      abiertaLock: null,
    },
  });

  if (actualizadas.count === 0) {
    return { success: false, error: "Ese turno ya fue cerrado desde otro dispositivo." };
  }

  revalidarCaja();
  return { success: true, data: { diferencia } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingresos y egresos manuales
// ─────────────────────────────────────────────────────────────────────────────

const movimientoSchema = z.object({
  tipo: z.enum(["INGRESO", "EGRESO"]),
  metodo: z.nativeEnum(MetodoPago).default("EFECTIVO"),
  monto: z.coerce.number().int().positive("El monto debe ser mayor a 0"),
  concepto: z.string().min(3, "Escribe para qué fue el movimiento").max(200),
});

/**
 * Plata que entra o sale sin ser una venta: pagarle al proveedor de la panadería,
 * un domicilio, un retiro a la caja fuerte, la base extra que se metió a media
 * tarde. Sin esto, todo turno con un gasto en efectivo cerraría con un faltante
 * que nadie sabe explicar.
 */
export async function registrarMovimientoCaja(input: unknown): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = movimientoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const sesion = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" }, include: { movimientos: true } });
  if (!sesion) return { success: false, error: "Abre la caja antes de registrar movimientos." };

  const { tipo, metodo, monto, concepto } = parsed.data;

  // Un egreso en efectivo no puede sacar más plata de la que hay en el cajón:
  // dejarlo pasar produce un "esperado" negativo que hace imposible cuadrar.
  if (tipo === "EGRESO" && metodo === "EFECTIVO") {
    const { esperadoEfectivo } = calcularResumenCaja(sesion.montoInicial, sesion.movimientos);
    if (monto > esperadoEfectivo) {
      return {
        success: false,
        error: `No hay tanto efectivo en caja. Disponible: ${formatCOP(esperadoEfectivo)}.`,
      };
    }
  }

  await prisma.movimientoCaja.create({
    data: { sesionId: sesion.id, tipo, metodo, monto, concepto: concepto.trim(), createdById: userId },
  });

  revalidarCaja();
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Retiro de socios
// ─────────────────────────────────────────────────────────────────────────────

const retiroSchema = z.object({
  metodo: z.nativeEnum(MetodoPago).default("EFECTIVO"),
  monto: z.coerce.number().int().positive("El monto debe ser mayor a 0"),
  concepto: z.string().max(200).optional(),
});

/**
 * La plata que los socios sacan para ellos, descontada del cupo del mes.
 *
 * Tiene acción propia y no es un EGRESO con otro nombre por dos razones que se
 * ven en los números: el turno debe poder mostrar "gastos" y "retiros" por
 * separado, y la contabilidad tiene que seguir restando el retiro debajo de la
 * utilidad. Un retiro anotado como egreso se contaría dos veces —una como costo
 * de operar y otra como reparto— y haría ver el negocio en pérdida.
 *
 * Dos límites distintos, a propósito:
 *  - El efectivo del cajón SÍ bloquea: no se puede sacar plata que no está.
 *  - El cupo mensual solo avisa. Es la plata de los socios; el sistema informa
 *    cuánto llevan y cuánto se pasaron, pero no les prohíbe sacarla.
 */
export async function registrarRetiroSocio(
  input: unknown
): Promise<ActionResult<{ retirado: number; saldo: number; exceso: number }>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = retiroSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const sesion = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" }, include: { movimientos: true } });
  if (!sesion) return { success: false, error: "Abre la caja antes de registrar un retiro." };

  const { metodo, monto, concepto } = parsed.data;

  if (metodo === "EFECTIVO") {
    const { esperadoEfectivo } = calcularResumenCaja(sesion.montoInicial, sesion.movimientos);
    if (monto > esperadoEfectivo) {
      return {
        success: false,
        error: `No hay tanto efectivo en el cajón. Disponible: ${formatCOP(esperadoEfectivo)}.`,
      };
    }
  }

  await prisma.movimientoCaja.create({
    data: {
      sesionId: sesion.id,
      tipo: "RETIRO",
      metodo,
      monto,
      concepto: concepto?.trim() || "Retiro de socios",
      createdById: userId,
    },
  });

  // Se relee el cupo DESPUÉS de guardar para que el aviso hable del estado
  // real del mes, incluido este retiro, y no de cómo estaban las cosas cuando
  // se abrió el modal.
  const cupo = await obtenerCupoDelMesActual();

  revalidarCaja();
  return { success: true, data: { retirado: cupo.retirado, saldo: cupo.saldo, exceso: cupo.exceso } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Venta de mostrador
// ─────────────────────────────────────────────────────────────────────────────

const ventaItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().max(99),
  extraIds: z.array(z.string()).default([]),
  notes: z.string().max(300).optional(),
});

const pagoSchema = z.object({
  metodo: z.nativeEnum(MetodoPago),
  monto: z.coerce.number().int().positive(),
});

const ventaSchema = z.object({
  items: z.array(ventaItemSchema).min(1, "Agrega al menos un producto"),
  pagos: z.array(pagoSchema).min(1, "Elige cómo pagó el cliente"),
  descuento: z.coerce.number().int().min(0).default(0),
  /** Billete con el que pagó el cliente, para calcular el cambio del ticket. */
  efectivoRecibido: z.coerce.number().int().min(0).optional(),
  clienteNombre: z.string().max(80).optional(),
  notas: z.string().max(300).optional(),
});

export type VentaCobrada = {
  orderId: string;
  total: number;
  cambio: number;
};

/**
 * Cobra una venta de mostrador. Todo ocurre en UNA transacción: el pedido, el
 * descuento de inventario según receta y el registro del pago en el turno. Si
 * cualquier paso falla, no queda ni la venta cobrada sin descontar insumos ni
 * el inventario descontado sin venta.
 *
 * Solo cubre ventas para llevar/consumo en el local. Un domicilio con
 * dirección se sigue registrando desde /admin/pedidos, que es donde vive el
 * flujo de estados (EN_CAMINO, ENTREGADO) y el mensaje de WhatsApp.
 */
export async function cobrarVenta(input: unknown): Promise<ActionResult<VentaCobrada>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = ventaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { items, pagos, descuento, efectivoRecibido, clienteNombre, notas } = parsed.data;

  const sesion = await prisma.cajaSesion.findFirst({ where: { estado: "ABIERTA" } });
  if (!sesion) return { success: false, error: "Abre la caja antes de cobrar." };

  // Precios reales desde la base de datos. `requireAvailable: false` porque en
  // el mostrador se puede vender algo que ya se marcó como agotado en la web.
  const pricing = await priceOrderItems(items, { requireAvailable: false });
  if (!pricing.ok) return { success: false, error: pricing.error };

  const { items: lineas, subtotal, descuentoPromos } = pricing;

  // El descuento manual que escribe la cajera se suma al automático de las
  // promociones vigentes. Se topa contra el subtotal para que la suma de los
  // dos no pueda dejar un total negativo.
  const descuentoTotal = Math.min(descuento + descuentoPromos, subtotal);

  if (descuento > subtotal) {
    return { success: false, error: "El descuento no puede superar el subtotal." };
  }

  const settings = await getSettings();
  const taxRate = Number(settings.taxRate) || 0;
  const base = subtotal - descuentoTotal;
  const tax = Math.floor((base * taxRate) / 100);
  const total = base + tax;

  const pagado = pagos.reduce((sum, p) => sum + p.monto, 0);
  if (pagado !== total) {
    return {
      success: false,
      error: `Los pagos suman ${formatCOP(pagado)} y el total es ${formatCOP(total)}. Ajusta los montos.`,
    };
  }

  const montoEfectivo = pagos.filter((p) => p.metodo === "EFECTIVO").reduce((s, p) => s + p.monto, 0);
  let cambio = 0;
  if (montoEfectivo > 0 && efectivoRecibido !== undefined) {
    if (efectivoRecibido < montoEfectivo) {
      return { success: false, error: "El efectivo recibido es menor a la parte que se paga en efectivo." };
    }
    cambio = efectivoRecibido - montoEfectivo;
  }

  // Método "principal": el de mayor monto. Es solo para poder listar y filtrar
  // pedidos sin un join; el desglose real de un pago mixto vive en MovimientoCaja.
  const metodoPrincipal = pagos.reduce((mayor, p) => (p.monto > mayor.monto ? p : mayor)).metodo;

  const cliente = await obtenerClienteMostrador();
  const notasVenta = [clienteNombre?.trim() ? `Cliente: ${clienteNombre.trim()}` : null, notas?.trim() || null]
    .filter(Boolean)
    .join(" · ");

  try {
    const orderId = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: cliente.id,
            status: "ENTREGADO",
            canal: "CAJA",
            cajaSesionId: sesion.id,
            deliveryType: "RECOGE_EN_TIENDA",
            notes: notasVenta || null,
            subtotal,
            deliveryFee: 0,
            tax,
            // El combinado, no solo el manual: si guardara `descuento` a secas,
            // el pedido diría que se cobró más de lo que de verdad entró y el
            // arqueo de caja cerraría con un sobrante fantasma cada vez que
            // alguien usara una promoción.
            discount: descuentoTotal,
            total,
            pointsEarned: 0,
            whatsappSent: false,
            metodoPago: metodoPrincipal,
            efectivoRecibido: montoEfectivo > 0 ? (efectivoRecibido ?? montoEfectivo) : null,
            cambio: montoEfectivo > 0 ? cambio : null,
            items: {
              create: lineas.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                notes: l.notes,
                extras: l.extras,
              })),
            },
          },
        });

        // La venta de mostrador ya está entregada, así que consume insumos ya
        // mismo — y lo hace DENTRO de esta transacción, no después.
        await descontarInventarioPorOrden(order.id, tx);

        await tx.movimientoCaja.createMany({
          data: pagos.map((p) => ({
            sesionId: sesion.id,
            tipo: "VENTA" as const,
            metodo: p.metodo,
            monto: p.monto,
            concepto: `Venta ${order.id.slice(-6).toUpperCase()}`,
            orderId: order.id,
            createdById: userId,
          })),
        });

        return order.id;
      },
      { timeout: 20_000 }
    );

    revalidarCaja();
    return { success: true, data: { orderId, total, cambio } };
  } catch (error) {
    console.error("Error al cobrar venta de caja:", error);
    return { success: false, error: "No se pudo registrar la venta. No se cobró nada; intenta de nuevo." };
  }
}

const anularSchema = z.object({
  orderId: z.string().min(1),
  motivo: z.string().min(3, "Escribe por qué se anula la venta").max(200),
});

/**
 * Anula una venta del turno abierto: devuelve los insumos al inventario y
 * revierte los pagos con movimientos de signo contrario.
 *
 * Los movimientos originales NO se borran. Un libro de caja se corrige
 * agregando el asiento inverso, nunca borrando el asiento equivocado: si se
 * pudiera borrar, el arqueo cuadraría igual y no quedaría rastro de que hubo
 * una anulación (que es justo lo que uno quiere poder auditar).
 *
 * Solo se pueden anular ventas del turno ABIERTO. Para una venta de un turno ya
 * cerrado hay que registrar la devolución como EGRESO del turno actual, porque
 * la plata sale del cajón de HOY, no del de ayer.
 */
export async function anularVenta(input: unknown): Promise<ActionResult> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = anularSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { orderId, motivo } = parsed.data;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { cajaSesion: true, movimientosCaja: true },
  });

  if (!order || order.canal !== "CAJA") return { success: false, error: "Esa venta no existe en la caja." };
  if (order.status === "CANCELADO") return { success: false, error: "Esa venta ya estaba anulada." };
  if (!order.cajaSesion || order.cajaSesion.estado !== "ABIERTA") {
    return {
      success: false,
      error: "Esa venta pertenece a un turno ya cerrado. Registra la devolución como egreso del turno actual.",
    };
  }

  const sesionId = order.cajaSesion.id;
  const pagosOriginales = order.movimientosCaja.filter((m) => m.tipo === "VENTA");

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: "CANCELADO", notes: `${order.notes ? `${order.notes} · ` : ""}ANULADA: ${motivo.trim()}` } });
        await revertirInventarioPorOrden(orderId, tx);

        if (pagosOriginales.length > 0) {
          await tx.movimientoCaja.createMany({
            data: pagosOriginales.map((p) => ({
              sesionId,
              // El inverso de una venta es una salida de plata: se le devuelve
              // al cliente. Por eso EGRESO y no una "venta negativa".
              tipo: "EGRESO" as const,
              metodo: p.metodo,
              monto: p.monto,
              concepto: `Anulación venta ${orderId.slice(-6).toUpperCase()} — ${motivo.trim()}`,
              orderId,
              createdById: userId,
            })),
          });
        }
      },
      { timeout: 20_000 }
    );
  } catch (error) {
    console.error("Error al anular venta de caja:", error);
    return { success: false, error: "No se pudo anular la venta. Intenta de nuevo." };
  }

  revalidarCaja();
  return { success: true };
}
