import { prisma } from "@/lib/prisma";
import type { MetodoPago, MovimientoCajaTipo } from "@prisma/client";

/**
 * Correo interno del cliente genérico del mostrador. Todas las ventas de caja
 * sin cliente identificado cuelgan de este único usuario.
 *
 * La alternativa (lo que hace `createManualOrder`) es crear un User por venta:
 * en el mostrador eso significa cientos de cuentas fantasma al mes ensuciando
 * /admin/clientes y las métricas de clientes recurrentes.
 *
 * Como contrapartida, este usuario SÍ existe en la tabla y hay que excluirlo
 * explícitamente de todo conteo de clientes — de ahí que la constante viva aquí
 * y no escondida dentro del server action.
 */
export const EMAIL_CLIENTE_MOSTRADOR = "mostrador@lamordida.local";

/** Filtro para no contar al cliente genérico del mostrador como una persona. */
export const EXCLUIR_CLIENTE_MOSTRADOR = { email: { not: EMAIL_CLIENTE_MOSTRADOR } } as const;

/**
 * Movimiento reducido a lo único que importa para el arqueo. Se tipa así (y no
 * como el modelo completo de Prisma) para que `calcularResumenCaja` sea una
 * función pura, testeable y reutilizable tanto con la caja abierta (totales al
 * vuelo) como al cerrarla (snapshot que se congela).
 */
export type MovimientoParaArqueo = {
  tipo: MovimientoCajaTipo;
  metodo: MetodoPago;
  monto: number;
  orderId: string | null;
};

export type ResumenCaja = {
  /** Total vendido en el turno, sumando todos los métodos de pago. */
  totalVentas: number;
  /** Número de ventas distintas (no de movimientos: un pago mixto son 2 filas). */
  cantidadVentas: number;
  totalEfectivo: number;
  totalNequi: number;
  totalOtros: number;
  totalIngresos: number;
  totalEgresos: number;
  /**
   * Cuánto efectivo FÍSICO debería haber en el cajón ahora mismo. Solo cuentan
   * los movimientos en efectivo: un pago por Nequi entra al celular, no al
   * cajón, y sumarlo aquí haría que todo turno cerrara con un faltante
   * fantasma exactamente igual al total de Nequi.
   */
  esperadoEfectivo: number;
};

export function calcularResumenCaja(
  montoInicial: number,
  movimientos: MovimientoParaArqueo[]
): ResumenCaja {
  let totalVentas = 0;
  let totalEfectivo = 0;
  let totalNequi = 0;
  let totalOtros = 0;
  let totalIngresos = 0;
  let totalEgresos = 0;
  let efectivoNeto = 0; // solo movimientos en efectivo, con su signo

  const ordenesVendidas = new Set<string>();

  for (const m of movimientos) {
    if (m.tipo === "VENTA") {
      totalVentas += m.monto;
      if (m.orderId) ordenesVendidas.add(m.orderId);
      if (m.metodo === "EFECTIVO") totalEfectivo += m.monto;
      else if (m.metodo === "NEQUI") totalNequi += m.monto;
      else totalOtros += m.monto;
    } else if (m.tipo === "INGRESO") {
      totalIngresos += m.monto;
    } else {
      totalEgresos += m.monto;
    }

    if (m.metodo === "EFECTIVO") {
      efectivoNeto += m.tipo === "EGRESO" ? -m.monto : m.monto;
    }
  }

  return {
    totalVentas,
    cantidadVentas: ordenesVendidas.size,
    totalEfectivo,
    totalNequi,
    totalOtros,
    totalIngresos,
    totalEgresos,
    esperadoEfectivo: montoInicial + efectivoNeto,
  };
}

/**
 * El turno abierto ahora mismo, con sus movimientos y el arqueo al vuelo.
 * Devuelve `null` si no hay caja abierta — la UI usa eso para mostrar la
 * pantalla de apertura en vez del POS.
 */
export async function obtenerCajaAbierta() {
  const sesion = await prisma.cajaSesion.findFirst({
    where: { estado: "ABIERTA" },
    include: {
      abiertaPor: { select: { id: true, name: true, email: true } },
      movimientos: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!sesion) return null;

  return { ...sesion, resumen: calcularResumenCaja(sesion.montoInicial, sesion.movimientos) };
}

/** Detalle completo de un turno (abierto o cerrado) para la vista de arqueo. */
export async function obtenerSesionCaja(id: string) {
  const sesion = await prisma.cajaSesion.findUnique({
    where: { id },
    include: {
      abiertaPor: { select: { name: true, email: true } },
      cerradaPor: { select: { name: true, email: true } },
      movimientos: { orderBy: { createdAt: "asc" } },
      ordenes: {
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  if (!sesion) return null;

  // Un turno cerrado muestra SIEMPRE su snapshot, no un recálculo: si mañana se
  // anula un pedido viejo, el arqueo que se firmó ese día debe seguir diciendo
  // lo mismo que decía cuando se contó la plata.
  const resumen =
    sesion.estado === "CERRADA"
      ? {
          totalVentas: sesion.totalVentas ?? 0,
          cantidadVentas: sesion.ordenes.length,
          totalEfectivo: sesion.totalEfectivo ?? 0,
          totalNequi: sesion.totalNequi ?? 0,
          totalOtros: sesion.totalOtros ?? 0,
          totalIngresos: sesion.totalIngresos ?? 0,
          totalEgresos: sesion.totalEgresos ?? 0,
          esperadoEfectivo: sesion.esperadoEfectivo ?? 0,
        }
      : calcularResumenCaja(sesion.montoInicial, sesion.movimientos);

  return { ...sesion, resumen };
}

/**
 * Código legible del turno: CAJA-260818-01. Es seguro contar sesiones del día
 * sin bloqueos porque el índice único `abiertaLock` garantiza que no puede
 * haber dos turnos abiertos a la vez, así que las aperturas del mismo día están
 * forzosamente serializadas.
 */
export async function generarCodigoSesion(fecha = new Date()) {
  const inicioDia = new Date(fecha);
  inicioDia.setHours(0, 0, 0, 0);
  const finDia = new Date(inicioDia);
  finDia.setDate(finDia.getDate() + 1);

  const delDia = await prisma.cajaSesion.count({
    where: { abiertaAt: { gte: inicioDia, lt: finDia } },
  });

  const yy = String(fecha.getFullYear()).slice(-2);
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");

  return `CAJA-${yy}${mm}${dd}-${String(delDia + 1).padStart(2, "0")}`;
}
