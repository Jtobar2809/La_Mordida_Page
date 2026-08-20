import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { ESTADOS_VENTA_CONFIRMADA } from "@/lib/inventario";

/**
 * Punto de equilibrio y reparto de costos fijos.
 *
 * La regla que ordena todo este archivo: el costo de un producto son sus
 * insumos, y punto. El arriendo no se mete en la receta — si se metiera, habría
 * que suponer cuántas hamburguesas se van a vender para poder dividirlo, y el
 * "costo" del plato cambiaría cada mes sin que nada hubiera cambiado en la
 * cocina. Lo que sí se puede decir con honestidad es cuánto aporta cada venta a
 * pagar esos fijos (margen de contribución) y cuánto hay que vender para
 * cubrirlos (punto de equilibrio).
 */

const estadosConfirmados = ESTADOS_VENTA_CONFIRMADA as OrderStatus[];

/**
 * Cuántos pedidos hacen falta antes de creerle a lo medido en vez de lo teórico.
 *
 * Con dos o tres ventas el "margen real" es el margen de esos dos platos, no el
 * del negocio: basta que uno haya sido el producto de peor margen para que el
 * número se desplome y el punto de equilibrio se vaya al doble. Lo mismo vale
 * para el ticket promedio — dos pedidos daban un ticket de $40.000 que no
 * describe nada. Por debajo de este piso se usan las recetas y los supuestos,
 * que al menos cubren toda la carta.
 */
const MINIMO_PEDIDOS_PARA_DATOS_REALES = 20;

/** Por qué no se puede repartir el costo fijo entre los productos. */
export type MotivoSinTasa =
  /** No hay ventas ni meta con la cual dividir. */
  | "SIN_REFERENCIA"
  /** Los costos fijos superan las ventas: el reparto daría cifras absurdas. */
  | "BAJO_EQUILIBRIO";

/** De dónde salió el margen con el que se calculó todo. */
export type OrigenMargen =
  /** De ventas que de verdad ocurrieron en el período. */
  | "REAL"
  /** De las recetas, porque todavía no hay ventas que medir. */
  | "RECETAS"
  /** No hay ni ventas ni recetas costeadas: no se puede calcular nada. */
  | "SIN_DATOS";

export type PanoramaOperacion = {
  costosFijos: { id: string; nombre: string; monto: number; categoria: string; notas: string | null }[];
  totalFijoMes: number;

  origenMargen: OrigenMargen;
  /** Fracción 0–1: de cada peso vendido, cuánto queda después de los insumos. */
  margenContribucion: number;

  /** Ventas mensuales necesarias para no perder plata. */
  ventasEquilibrio: number;
  /** Las mismas ventas repartidas entre los días que se abre al mes. */
  ventasEquilibrioDia: number;
  /** Pedidos diarios necesarios; null si todavía no hay un ticket promedio conocido. */
  pedidosEquilibrioDia: number | null;

  ticketPromedio: number | null;
  ticketEsReal: boolean;
  diasOperacion: number;

  /** Ventas del período con las que se compara el equilibrio (reales o la meta). */
  ventasReferencia: number;
  ventasSonReales: boolean;
  /**
   * Qué fracción de cada peso vendido se va en costos fijos. Es la que reparte
   * el arriendo por producto en la pantalla de Recetas. null cuando no hay una
   * cifra de ventas con la que dividir — inventarla sería peor que no mostrarla.
   */
  tasaOperacion: number | null;
  /** Cuando tasaOperacion es null, por qué. */
  motivoSinTasa: MotivoSinTasa | null;

  /** Productos que no tienen receta: su margen es desconocido, no del 100%. */
  productosSinReceta: string[];
};

export async function obtenerPanoramaOperacion(dias = 30): Promise<PanoramaOperacion> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const [costosFijos, settings, ventas, movimientosVenta, productos] = await Promise.all([
    prisma.costoFijo.findMany({
      where: { activo: true },
      orderBy: [{ categoria: "asc" }, { monto: "desc" }],
      select: { id: true, nombre: true, monto: true, categoria: true, notas: true },
    }),
    getSettings(),
    prisma.order.aggregate({
      where: { status: { in: estadosConfirmados }, createdAt: { gte: desde } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    // SALIDA y ENTRADA: cancelar un pedido no borra la salida, crea una entrada
    // que la compensa. Mirando solo las SALIDA, cada cancelación quedaba sumada
    // al costo de venta como si la comida se hubiera consumido — un pedido
    // cancelado de $28.000 inflaba el costo en los $16.208 de su receta.
    // Restando las entradas el libro mayor se cuadra solo, y también aguanta el
    // caso de un pedido que se cancela y se vuelve a confirmar.
    prisma.movimientoInsumo.findMany({
      where: { tipo: { in: ["SALIDA", "ENTRADA"] }, orderId: { not: null }, createdAt: { gte: desde } },
      include: { insumo: { select: { costoUnitario: true } } },
    }),
    prisma.product.findMany({
      where: { available: true },
      include: { recetaItems: { include: { insumo: { select: { costoUnitario: true } } } } },
    }),
  ]);

  const totalFijoMes = costosFijos.reduce((sum, c) => sum + c.monto, 0);

  const ingresosReales = ventas._sum?.total ?? 0;
  const pedidosReales = ventas._count._all;
  const cogsReal = movimientosVenta.reduce((sum, m) => {
    const costo = m.cantidad * (m.costoUnitario ?? m.insumo.costoUnitario);
    return m.tipo === "ENTRADA" ? sum - costo : sum + costo;
  }, 0);

  // Margen: se prefiere lo que de verdad pasó. Solo si no hay ventas se recurre
  // a las recetas, y se dice de dónde salió para que nadie confunda una
  // proyección con un hecho.
  let origenMargen: OrigenMargen;
  let margenContribucion: number;

  const conReceta = productos.filter((p) => p.recetaItems.length > 0 && p.price > 0);
  const productosSinReceta = productos.filter((p) => p.recetaItems.length === 0).map((p) => p.name);

  // Una sola regla decide si se le cree a lo medido, para que el margen y el
  // ticket no puedan salir de fuentes distintas y contarse historias diferentes.
  const muestraSuficiente = pedidosReales >= MINIMO_PEDIDOS_PARA_DATOS_REALES;

  if (ingresosReales > 0 && muestraSuficiente) {
    origenMargen = "REAL";
    margenContribucion = (ingresosReales - cogsReal) / ingresosReales;
  } else if (conReceta.length > 0) {
    // Promedio ponderado por precio, no promedio simple: si no, un adicional de
    // $2.000 pesaría lo mismo que una hamburguesa de $32.000 y el margen saldría
    // parecido al de los adicionales, que no es lo que se vende.
    //
    // Los productos SIN receta quedan fuera del cálculo a propósito. Incluirlos
    // los contaría con margen del 100% (costo cero) e inflaría el promedio, que
    // es justo el error que hace creer que el negocio va mejor de lo que va.
    const sumaPrecios = conReceta.reduce((s, p) => s + p.price, 0);
    const sumaCostos = conReceta.reduce(
      (s, p) => s + p.recetaItems.reduce((t, r) => t + r.cantidad * r.insumo.costoUnitario, 0),
      0
    );
    origenMargen = "RECETAS";
    margenContribucion = (sumaPrecios - sumaCostos) / sumaPrecios;
  } else {
    origenMargen = "SIN_DATOS";
    margenContribucion = 0;
  }

  const diasOperacion = Math.max(1, Number(settings.diasOperacionMes) || 30);

  // Punto de equilibrio: cuánto hay que vender para que el margen de
  // contribución alcance exactamente a pagar los fijos.
  const ventasEquilibrio = margenContribucion > 0 ? totalFijoMes / margenContribucion : 0;

  const ticketReal = muestraSuficiente ? ingresosReales / pedidosReales : null;
  const ticketEstimado = Number(settings.ticketPromedioEstimado) || 0;
  const ticketPromedio = ticketReal ?? (ticketEstimado > 0 ? ticketEstimado : null);

  // Para el reparto del arriendo por producto la meta manda sobre las ventas
  // medidas. No es un capricho: la pregunta que responde ese reparto es "a mi
  // ritmo normal de ventas, cuánto del arriendo le toca a este plato", y dos
  // días de operación no son el ritmo normal. Dividir $3.900.000 de fijos entre
  // $80.000 de dos pedidos daba una tasa del 4875%, o sea $1.560.000 de
  // "operación" en una hamburguesa de $32.000.
  const ventasEstimadasMes = Number(settings.ventasEstimadasMes) || 0;

  // Dos denominadores distintos porque son dos preguntas distintas.
  //
  // La barra de progreso pregunta "¿cómo voy?", así que compara contra lo que
  // de verdad se ha vendido; si todavía no hay ventas, contra la meta.
  const ventasSonReales = ingresosReales > 0;
  const ventasReferencia = ventasSonReales ? ingresosReales : ventasEstimadasMes;

  // El reparto del arriendo pregunta "a mi ritmo normal, ¿cuánto le toca a este
  // plato?", y dos días de operación no son el ritmo normal. Por eso la meta
  // manda aquí: dividir $3.900.000 de fijos entre $80.000 de dos pedidos daba
  // una tasa del 4875%, o sea $1.560.000 de "operación" en una hamburguesa de
  // $32.000.
  const baseTasa = ventasEstimadasMes > 0 ? ventasEstimadasMes : ingresosReales;
  const tasaCruda = baseTasa > 0 ? totalFijoMes / baseTasa : null;
  // Una tasa por encima de 1 significa que los fijos se comen más que todo lo
  // vendido. Repartirla igual produciría "costos" mayores que el precio de
  // venta, que no informan nada; lo que hay que decir en ese caso es que el
  // negocio está por debajo del equilibrio, y eso lo dice la pantalla aparte.
  const tasaOperacion = tasaCruda !== null && tasaCruda <= 1 ? tasaCruda : null;
  const motivoSinTasa: MotivoSinTasa | null =
    tasaOperacion !== null ? null : tasaCruda === null ? "SIN_REFERENCIA" : "BAJO_EQUILIBRIO";

  return {
    costosFijos,
    totalFijoMes,
    origenMargen,
    margenContribucion,
    ventasEquilibrio,
    ventasEquilibrioDia: ventasEquilibrio / diasOperacion,
    pedidosEquilibrioDia:
      ticketPromedio && ticketPromedio > 0 ? ventasEquilibrio / ticketPromedio / diasOperacion : null,
    ticketPromedio,
    ticketEsReal: ticketReal !== null,
    diasOperacion,
    ventasReferencia,
    ventasSonReales,
    tasaOperacion,
    motivoSinTasa,
    productosSinReceta,
  };
}

export const CATEGORIA_LABEL: Record<string, string> = {
  ARRIENDO: "Arriendo",
  SERVICIOS: "Servicios",
  MANO_DE_OBRA: "Mano de obra",
  ADMINISTRATIVO: "Administrativo",
  OTRO: "Otro",
};
