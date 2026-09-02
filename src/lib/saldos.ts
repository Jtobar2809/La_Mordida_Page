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
   * Plata que salió por este medio sin pasar por la caja: un gasto anotado en
   * contabilidad, una compra al proveedor de la plaza a las 6 a.m. cuando no
   * hay turno abierto. Salió de la plata real igual que lo demás, pero por
   * otra puerta.
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

/**
 * Plata que salió sin pasar por la caja, ya sea una compra al proveedor o un
 * gasto anotado en contabilidad.
 *
 * Los dos se normalizan a esta misma forma a propósito. Vivían con reglas
 * distintas —la compra descontaba, el gasto solo avisaba— y esa asimetría era
 * exactamente lo que descuadraba el cuadro: dos salidas idénticas de la misma
 * plata, tratadas distinto según en cuál pantalla se hubieran anotado.
 */
export type SalidaSinCaja = {
  monto: number;
  metodoPago: MetodoPago;
  fecha: Date;
};

/**
 * De un montón de salidas que no pasaron por la caja, cuáles descuentan de este
 * medio de pago.
 *
 * `desde` es el ancla del medio —el último arqueo de Nequi, el último cierre
 * del cajón— y el filtro es estricto (`>`): lo que salió ANTES de ese instante
 * ya está descontado de lo que se contó ese día, y volver a restarlo cobraría
 * el mismo bulto de papas dos veces. Sin ancla (nunca se ha arqueado ni cerrado
 * un turno) cuentan todas, que es lo correcto: no hay conteo previo que las
 * haya absorbido.
 *
 * Lo pagado con OTRO nunca entra acá a propósito: no es cajón ni es Nequi, así
 * que ningún saldo lo puede seguir. Sale como alerta.
 */
export function salidasQueDescuentan<T extends SalidaSinCaja>(
  salidas: T[],
  opciones: { metodo: MetodoPago; desde: Date | null }
): T[] {
  const { metodo, desde } = opciones;
  if (metodo === "OTRO") return [];
  return salidas.filter((s) => s.metodoPago === metodo && (!desde || s.fecha > desde));
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
      select: { codigo: true, montoInicial: true, efectivoContado: true, estado: true, cerradaAt: true },
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

  // ── Desde cuándo cuenta cada medio ──────────────────────────────────────
  // Nequi cuenta desde el último arqueo. El cajón, desde el último cierre: el
  // momento en que alguien contó los billetes y firmó. Lo que salió ANTES de
  // esa fecha ya está descontado de lo contado, y restarlo otra vez sería
  // cobrar la misma compra dos veces.
  //
  // El ancla del Nequi es el último arqueo si existe, y si no el saldo que se
  // configuró al empezar a llevar la cuenta. Un arqueo REANCLA —se cuenta desde
  // lo contado, no desde el histórico— para que un descuadre ya verificado a
  // mano no se quede restando para siempre.
  // Los paréntesis no son decorativos: `??` mezclado con `||` sin ellos no
  // compila. Y el `|| 0` hace falta porque el ajuste es texto libre y un campo
  // vacío daría NaN, que envenenaría todas las sumas de abajo en silencio.
  const anclaNequi = ultimoArqueo?.saldoReal ?? (Number(settings.nequiSaldoInicial) || 0);
  const desdeArqueo = ultimoArqueo?.fecha ?? null;
  const desdeCierre = ultimaCerrada?.cerradaAt ?? null;

  // Compras y gastos se piden una sola vez, acotados por la más vieja de las
  // dos anclas; después cada medio se queda con lo suyo. Si alguna de las dos
  // no existe todavía (nunca se ha arqueado, nunca se ha cerrado un turno) hay
  // que traerlos todos: no hay fecha desde la cual recortar.
  const anclaMasVieja =
    desdeArqueo && desdeCierre ? new Date(Math.min(desdeArqueo.getTime(), desdeCierre.getTime())) : null;

  const [movimientosNequi, gastosSueltos, comprasSueltas] = await Promise.all([
    prisma.movimientoCaja.findMany({
      // `gt` y no `gte`: el arqueo ya contó todo lo que existía en ese instante.
      where: { metodo: "NEQUI", ...(desdeArqueo ? { createdAt: { gt: desdeArqueo } } : {}) },
      select: { tipo: true, metodo: true, monto: true, order: { select: { status: true } } },
    }),

    // Los gastos que NUNCA pasaron por la caja. Se filtran por `fecha` y no por
    // `createdAt` porque lo que importa es cuándo salió la plata, no cuándo se
    // anotó: un gasto del lunes registrado el miércoles salió el lunes.
    prisma.gasto.findMany({
      where: { movimientoCaja: null, ...(anclaMasVieja ? { fecha: { gt: anclaMasVieja } } : {}) },
      select: { monto: true, metodoPago: true, fecha: true },
    }),

    // Las compras que NO salieron por la caja. Las que sí tienen su egreso ya
    // están restadas dentro de los movimientos del turno; contarlas aquí otra
    // vez dejaría el saldo bajo por el valor de cada bulto de papas.
    prisma.compra.findMany({
      where: { movimientoCaja: null, ...(anclaMasVieja ? { fecha: { gt: anclaMasVieja } } : {}) },
      select: { total: true, metodoPago: true, fecha: true },
    }),
  ]);

  // Compras y gastos son la misma cosa para el saldo: plata que salió por una
  // puerta distinta a la caja. `total` y `monto` son el mismo número con dos
  // nombres, herencia de que cada libro se escribió por su lado.
  const salidasSinCaja = [
    ...comprasSueltas.map((c) => ({ monto: c.total, metodoPago: c.metodoPago, fecha: c.fecha, origen: "compra" as const })),
    ...gastosSueltos.map((g) => ({ monto: g.monto, metodoPago: g.metodoPago, fecha: g.fecha, origen: "gasto" as const })),
  ];

  const fueraDeCajaEfectivo = salidasQueDescuentan(salidasSinCaja, { metodo: "EFECTIVO", desde: desdeCierre });
  const fueraDeCajaNequi = salidasQueDescuentan(salidasSinCaja, { metodo: "NEQUI", desde: desdeArqueo });
  const conOtroMedio = salidasSinCaja.filter((s) => s.metodoPago === "OTRO");
  const sumar = (filas: { monto: number }[]) => filas.reduce((s, f) => s + f.monto, 0);

  // ── Efectivo en el cajón ────────────────────────────────────────────────
  // Lo que salió en efectivo sin pasar por la caja se resta del cajón aunque el
  // turno esté cerrado y contado. Es la única excepción a "lo contado manda", y
  // la razón es la fecha: solo cuenta lo posterior al cierre, o sea plata que
  // salió DESPUÉS del conteo. El conteo describía el cajón de anoche, no el de
  // ahora.
  const efectivoFueraDeCaja = sumar(fueraDeCajaEfectivo);

  const efectivoBase = calcularSaldo({
    metodo: "EFECTIVO",
    ancla: sesionAbierta?.montoInicial ?? 0,
    movimientos: movimientosTurno,
    salidasFueraDeCaja: efectivoFueraDeCaja,
  });

  const efectivo = {
    ...efectivoBase,
    hayTurnoAbierto: !!sesionAbierta,
    turnoCodigo: sesionAbierta?.codigo ?? ultimaCerrada?.codigo ?? null,
    contado: sesionAbierta ? null : (ultimaCerrada?.efectivoContado ?? null),
    // Sin turno abierto el cajón no tiene un "esperado" que valga: manda lo que
    // se contó al cerrar, menos lo que se haya gastado desde entonces.
    saldo: sesionAbierta
      ? efectivoBase.saldo
      : (ultimaCerrada?.efectivoContado ?? 0) - efectivoFueraDeCaja,
  };

  const guardado = calcularEfectivoGuardado(sesiones);

  // ── Nequi ───────────────────────────────────────────────────────────────
  const nequiBase = calcularSaldo({
    metodo: "NEQUI",
    ancla: anclaNequi,
    movimientos: movimientosNequi.map((m) => ({
      tipo: m.tipo,
      metodo: m.metodo,
      monto: m.monto,
      estadoOrden: m.order?.status ?? null,
    })),
    // Compras y gastos por Nequi que nunca pasaron por la caja. La regla es la
    // misma que en el cajón —solo lo posterior al ancla— y lo único que cambia
    // es cuál es el ancla: acá el último arqueo, allá el último cierre.
    salidasFueraDeCaja: sumar(fueraDeCajaNequi),
  });

  const nequi = {
    ...nequiBase,
    ancladoAt: desdeArqueo,
    ultimaDiferencia: ultimoArqueo?.diferencia ?? null,
  };

  // ── Lo que puede estar descuadrando el cuadro ───────────────────────────
  const alertas: AlertaSaldo[] = [];

  // Cómo se lee cada alerta: la primera dice "la plata ya cuadra, lo que falta
  // es el rastro"; la segunda dice "la plata NO cuadra". Son problemas
  // distintos y por eso no se juntan en una sola línea.
  const contar = (filas: { origen: "compra" | "gasto" }[]) => {
    const compras = filas.filter((f) => f.origen === "compra").length;
    const gastos = filas.length - compras;
    const partes = [
      compras > 0 ? `${compras} compra${compras === 1 ? "" : "s"}` : null,
      gastos > 0 ? `${gastos} gasto${gastos === 1 ? "" : "s"}` : null,
    ].filter(Boolean);
    return partes.join(" y ");
  };

  const fueraDeCaja = [...fueraDeCajaEfectivo, ...fueraDeCajaNequi];
  if (fueraDeCaja.length > 0) {
    alertas.push({
      clave: "salidas-sin-caja",
      titulo: `${contar(fueraDeCaja)} sin egreso de caja`,
      detalle:
        "Ya están restados de los saldos de arriba, así que la plata cuadra. Lo que no tienen es turno: se registraron sin caja abierta o con fecha vieja, y por eso no van a aparecer en ningún arqueo.",
      monto: sumar(fueraDeCaja),
    });
  }

  if (conOtroMedio.length > 0) {
    alertas.push({
      clave: "salidas-otro-medio",
      titulo: `${contar(conOtroMedio)} con medio de pago “Otro”`,
      detalle:
        "No es cajón ni es Nequi, así que ningún saldo lo sigue y los de arriba están altos por ese valor. Si en realidad salió de alguno de los dos, corrige el medio de pago.",
      monto: sumar(conOtroMedio),
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
