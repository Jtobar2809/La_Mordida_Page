import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import type { MetodoPago, MovimientoCajaTipo } from "@prisma/client";

/**
 * Dónde está la plata: cuánto debería haber HOY en el cajón y cuánto en Nequi.
 *
 * El resto de la contabilidad responde preguntas de período —cuánto se vendió
 * en agosto, cuánto costó—. Esta responde una de saldo, que es distinta: no
 * tiene mes, tiene "ahora". Por eso `obtenerSaldos` no recibe año ni mes.
 *
 * Los dos medios se cuentan distinto porque son cosas distintas:
 *
 *  - El **cajón** se vacía y se vuelve a llenar cada turno. Su ancla es la base
 *    del turno abierto y su saldo es `esperadoEfectivo`, que ya calcula
 *    `lib/caja.ts` y que alguien cuenta y firma al cerrar.
 *  - El **Nequi** no se vacía nunca. El saldo del celular es acumulado, así que
 *    su ancla es el último arqueo (o el saldo inicial configurado, si todavía
 *    no se ha hecho ninguno) y desde ahí se suma y se resta hacia adelante.
 *
 * Lo que este archivo NO hace: filtrar las ventas anuladas. Un saldo cuenta
 * plata que se movió, no ventas que valen. Anular deja el cobro original y le
 * suma la devolución; los dos son movimientos reales y los dos tienen que
 * estar, o el saldo deja de describir lo que hay. Es la misma decisión que toma
 * `efectivoNeto` en `lib/caja.ts`.
 */

export type MovimientoParaSaldo = {
  tipo: MovimientoCajaTipo;
  metodo: MetodoPago;
  monto: number;
  /** Solo para poder mostrar aparte cuánto de lo que salió fue devolución. */
  estadoOrden?: string | null;
};

export type FuenteSaldo = {
  /** Lo que había cuando se empezó a contar: la base del turno, el último arqueo. */
  ancla: number;
  /** Ventas e ingresos por este medio desde el ancla. */
  entradas: number;
  /** Egresos y retiros por este medio desde el ancla. */
  salidas: number;
  /** Subconjunto de `salidas`: plata devuelta por ventas anuladas. */
  anulaciones: number;
  /** Subconjunto de `salidas`: lo que los socios sacaron por este medio. */
  retiros: number;
  /**
   * Gastos anotados con este medio que nunca pasaron por la caja. Salieron de
   * la plata real igual que los demás, pero por otra puerta.
   */
  salidasFueraDeCaja: number;
  /** ancla + entradas − salidas − salidasFueraDeCaja. */
  saldo: number;
};

/**
 * El saldo de UN medio de pago. Pura a propósito: es la única forma de poder
 * probar contra la mano los casos que importan (una anulación, un retiro por
 * Nequi, un gasto que no pasó por caja) sin montar base de datos.
 */
export function calcularSaldo(opciones: {
  metodo: MetodoPago;
  ancla: number;
  movimientos: MovimientoParaSaldo[];
  salidasFueraDeCaja?: number;
}): FuenteSaldo {
  const { metodo, ancla, movimientos, salidasFueraDeCaja = 0 } = opciones;

  let entradas = 0;
  let salidas = 0;
  let anulaciones = 0;
  let retiros = 0;

  for (const m of movimientos) {
    if (m.metodo !== metodo) continue;

    if (m.tipo === "VENTA" || m.tipo === "INGRESO") {
      entradas += m.monto;
    } else {
      salidas += m.monto;
      if (m.tipo === "RETIRO") retiros += m.monto;
      else if (m.estadoOrden === "CANCELADO") anulaciones += m.monto;
    }
  }

  return {
    ancla,
    entradas,
    salidas,
    anulaciones,
    retiros,
    salidasFueraDeCaja,
    saldo: ancla + entradas - salidas - salidasFueraDeCaja,
  };
}

export type EfectivoGuardado = {
  /** Lo que sobró de los cierres y no volvió como base del turno siguiente. */
  monto: number;
  /** Cuántos cierres aportaron a esa cifra, para saber qué tan sólida es. */
  cierres: number;
};

/**
 * El efectivo que salió del cajón al cerrar y no volvió a entrar como base.
 *
 * Es la única cifra de este archivo que se DEDUCE en vez de leerse: nadie
 * registra qué pasa con la plata entre que se cuenta al cerrar y que se abre el
 * turno siguiente. Si el turno cerró con $400.000 contados y el siguiente abrió
 * con $100.000 de base, $300.000 se guardaron en alguna parte — pero eso lo
 * dice la resta, no un asiento.
 *
 * Se expone igual porque la alternativa es peor: sin este renglón el cuadro
 * diría que en el negocio solo está la base del turno abierto, y el dueño
 * concluiría que le falta plata que sí tiene.
 *
 * `sesiones` debe venir ordenada por apertura ASCENDENTE. El último turno no
 * aporta: mientras no se abra el siguiente, su plata sigue nominalmente en el
 * cajón y ya la cuenta la fila de arriba.
 */
export function calcularEfectivoGuardado(
  sesiones: { montoInicial: number; efectivoContado: number | null }[]
): EfectivoGuardado {
  let monto = 0;
  let cierres = 0;

  for (let i = 0; i < sesiones.length - 1; i++) {
    const contado = sesiones[i]?.efectivoContado;
    if (contado === null || contado === undefined) continue;

    monto += contado - (sesiones[i + 1]?.montoInicial ?? 0);
    cierres++;
  }

  return { monto, cierres };
}

export type AlertaSaldo = {
  clave: string;
  titulo: string;
  detalle: string;
  monto: number;
};

export type Saldos = {
  efectivo: FuenteSaldo & {
    hayTurnoAbierto: boolean;
    turnoCodigo: string | null;
    /**
     * Lo contado al cerrar, cuando no hay turno abierto. En ese caso ES el
     * saldo: alguien ya lo verificó a mano, y lo verificado le gana a lo
     * calculado.
     */
    contado: number | null;
  };
  guardado: EfectivoGuardado;
  nequi: FuenteSaldo & {
    /** Fecha del arqueo que ancla el saldo. Null = nunca se ha arqueado. */
    ancladoAt: Date | null;
    /** Diferencia del último arqueo, para poder mostrar cómo salió. */
    ultimaDiferencia: number | null;
  };
  /** Cajón + guardado + Nequi: toda la plata del negocio en una sola cifra. */
  total: number;
  alertas: AlertaSaldo[];
};

export async function obtenerSaldos(): Promise<Saldos> {
  const [settings, ultimoArqueo, sesionAbierta, sesiones] = await Promise.all([
    getSettings(),
    prisma.arqueoNequi.findFirst({ orderBy: { fecha: "desc" } }),

    prisma.cajaSesion.findFirst({
      where: { estado: "ABIERTA" },
      select: {
        codigo: true,
        montoInicial: true,
        movimientos: {
          select: { tipo: true, metodo: true, monto: true, order: { select: { status: true } } },
        },
      },
    }),

    prisma.cajaSesion.findMany({
      orderBy: { abiertaAt: "asc" },
      select: { codigo: true, montoInicial: true, efectivoContado: true, estado: true },
    }),
  ]);

  // ── Efectivo en el cajón ────────────────────────────────────────────────
  const movimientosTurno: MovimientoParaSaldo[] = (sesionAbierta?.movimientos ?? []).map((m) => ({
    tipo: m.tipo,
    metodo: m.metodo,
    monto: m.monto,
    estadoOrden: m.order?.status ?? null,
  }));

  const ultimaCerrada = [...sesiones].reverse().find((s) => s.estado === "CERRADA");

  const efectivoBase = calcularSaldo({
    metodo: "EFECTIVO",
    ancla: sesionAbierta?.montoInicial ?? 0,
    movimientos: movimientosTurno,
  });

  const efectivo = {
    ...efectivoBase,
    hayTurnoAbierto: !!sesionAbierta,
    turnoCodigo: sesionAbierta?.codigo ?? ultimaCerrada?.codigo ?? null,
    contado: sesionAbierta ? null : (ultimaCerrada?.efectivoContado ?? null),
    // Sin turno abierto el cajón no tiene un "esperado" que valga: manda lo que
    // se contó al cerrar. Contar le gana a calcular.
    saldo: sesionAbierta ? efectivoBase.saldo : (ultimaCerrada?.efectivoContado ?? 0),
  };

  const guardado = calcularEfectivoGuardado(sesiones);

  // ── Nequi ───────────────────────────────────────────────────────────────
  // El ancla: el último arqueo si existe, y si no el saldo que se configuró al
  // empezar a llevar la cuenta. Un arqueo REANCLA —se cuenta desde lo contado,
  // no desde el histórico— para que un descuadre ya verificado a mano no se
  // quede restando para siempre.
  // Los paréntesis no son decorativos: `??` mezclado con `||` sin ellos no
  // compila. Y el `|| 0` hace falta porque el ajuste es texto libre y un campo
  // vacío daría NaN, que envenenaría todas las sumas de abajo en silencio.
  const anclaNequi = ultimoArqueo?.saldoReal ?? (Number(settings.nequiSaldoInicial) || 0);
  const desdeArqueo = ultimoArqueo?.fecha ?? null;

  const [movimientosNequi, gastosSueltos, comprasRecientes] = await Promise.all([
    prisma.movimientoCaja.findMany({
      // `gt` y no `gte`: el arqueo ya contó todo lo que existía en ese instante.
      where: { metodo: "NEQUI", ...(desdeArqueo ? { createdAt: { gt: desdeArqueo } } : {}) },
      select: { tipo: true, metodo: true, monto: true, order: { select: { status: true } } },
    }),

    // Los gastos que NUNCA pasaron por la caja. Se filtran por `fecha` y no por
    // `createdAt` porque lo que importa es cuándo salió la plata, no cuándo se
    // anotó: un gasto del lunes registrado el miércoles salió el lunes.
    prisma.gasto.findMany({
      where: { movimientoCaja: null, ...(desdeArqueo ? { fecha: { gt: desdeArqueo } } : {}) },
      select: { monto: true, metodoPago: true },
    }),

    prisma.compra.aggregate({
      where: desdeArqueo ? { fecha: { gt: desdeArqueo } } : {},
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  const sueltosNequi = gastosSueltos.filter((g) => g.metodoPago === "NEQUI");
  const sueltosEfectivo = gastosSueltos.filter((g) => g.metodoPago === "EFECTIVO");

  const nequiBase = calcularSaldo({
    metodo: "NEQUI",
    ancla: anclaNequi,
    movimientos: movimientosNequi.map((m) => ({
      tipo: m.tipo,
      metodo: m.metodo,
      monto: m.monto,
      estadoOrden: m.order?.status ?? null,
    })),
    // En Nequi los gastos sueltos SÍ se restan del saldo, y en efectivo no.
    // No es incoherencia: el cajón tiene un arqueo firmado que manda sobre
    // cualquier cálculo, y meterle una resta por fuera lo haría mentir. Nequi
    // no tiene nada más, así que este gasto es el único rastro de esa plata.
    salidasFueraDeCaja: sueltosNequi.reduce((s, g) => s + g.monto, 0),
  });

  const nequi = {
    ...nequiBase,
    ancladoAt: desdeArqueo,
    ultimaDiferencia: ultimoArqueo?.diferencia ?? null,
  };

  // ── Lo que puede estar descuadrando el cuadro ───────────────────────────
  const alertas: AlertaSaldo[] = [];

  const totalSueltosEfectivo = sueltosEfectivo.reduce((s, g) => s + g.monto, 0);
  if (totalSueltosEfectivo > 0) {
    alertas.push({
      clave: "gastos-efectivo-sin-caja",
      titulo: `${sueltosEfectivo.length} gasto${sueltosEfectivo.length === 1 ? "" : "s"} en efectivo sin egreso de caja`,
      detalle:
        "Esa plata salió del cajón pero el turno no se enteró, así que el arqueo va a mostrar un faltante justo por ese valor. Pasa cuando el gasto se anota con fecha vieja o sin caja abierta.",
      monto: totalSueltosEfectivo,
    });
  }

  if (nequiBase.salidasFueraDeCaja > 0) {
    alertas.push({
      clave: "gastos-nequi-sin-caja",
      titulo: `${sueltosNequi.length} gasto${sueltosNequi.length === 1 ? "" : "s"} por Nequi sin egreso de caja`,
      detalle:
        "Ya están restados del saldo de arriba, pero no aparecen en ningún turno. Registrarlos como egreso desde la caja los deja auditables.",
      monto: nequiBase.salidasFueraDeCaja,
    });
  }

  const comprasSinRastro = comprasRecientes._sum?.total ?? 0;
  if (comprasSinRastro > 0) {
    alertas.push({
      clave: "compras-sin-medio",
      titulo: `${comprasRecientes._count._all} compra${comprasRecientes._count._all === 1 ? "" : "s"} a proveedores`,
      detalle:
        "Una compra no anota con qué se pagó, así que por sí sola no descuenta de ningún saldo. Si le pagaste al proveedor del cajón o por Nequi y no lo registraste como egreso, los saldos de arriba están altos por ese valor.",
      monto: comprasSinRastro,
    });
  }

  const netoOtros = movimientosTurno
    .filter((m) => m.metodo === "OTRO")
    .reduce((s, m) => s + (m.tipo === "VENTA" || m.tipo === "INGRESO" ? m.monto : -m.monto), 0);
  if (netoOtros !== 0) {
    alertas.push({
      clave: "medio-otro",
      titulo: "Hay plata cobrada como “Otro” medio",
      detalle: "No es cajón ni es Nequi, así que ningún saldo la sigue. Vale la pena anotar de qué medio se trata.",
      monto: netoOtros,
    });
  }

  return {
    efectivo,
    guardado,
    nequi,
    total: efectivo.saldo + guardado.monto + nequi.saldo,
    alertas,
  };
}
