/**
 * Reglas de costo del inventario, en un solo lugar.
 *
 * La idea de fondo: el precio se escribe UNA vez, en Insumos, y siempre de la
 * forma en que de verdad se compra ("$25.000 por 3.000 g"). Todo lo demás
 * —composiciones, producciones, recetas— solo multiplica cantidades por ese
 * costo; en ninguna de esas pantallas se vuelve a escribir un precio.
 */

/** Máximo de decimales que guardamos en un costo por unidad. */
const DECIMALES_COSTO = 4;

/** Recorta la basura de punto flotante sin perder la precisión que importa. */
export function redondearCosto(valor: number) {
  if (!Number.isFinite(valor)) return 0;
  const factor = 10 ** DECIMALES_COSTO;
  return Math.round(valor * factor) / factor;
}

/** Redondeo "de cocina": 2 decimales, para cantidades en pantalla. */
export function redondearCantidad(valor: number) {
  if (!Number.isFinite(valor)) return 0;
  return Math.round(valor * 100) / 100;
}

/**
 * Costo de 1 unidad a partir del par precio/cantidad tal como se compró.
 * Una cantidad de referencia en 0 significaría dividir por cero, así que se
 * trata como 1 (el precio es de una sola unidad).
 */
export function costoPorUnidad(precioReferencia: number, cantidadReferencia: number) {
  const cantidad = cantidadReferencia > 0 ? cantidadReferencia : 1;
  return redondearCosto(precioReferencia / cantidad);
}

/**
 * El camino inverso: cuando el costo por unidad lo calcula el sistema (promedio
 * ponderado de una compra, costo de una producción, recálculo de un elaborado),
 * hay que dejar el par precio/cantidad coherente. Si no, la próxima vez que se
 * abriera el formulario del insumo mostraría el precio viejo y al guardar
 * pisaría el costo recién calculado.
 */
export function referenciaDesdeCosto(costoUnitario: number, cantidadReferencia: number) {
  const cantidad = cantidadReferencia > 0 ? cantidadReferencia : 1;
  return {
    costoUnitario: redondearCosto(costoUnitario),
    precioReferencia: redondearCosto(costoUnitario * cantidad),
    cantidadReferencia: cantidad,
  };
}

/**
 * Cuánto de un componente entra en 1 unidad del elaborado. La composición se
 * anota con los pesos reales de la tanda (400 g de mayonesa) y el rendimiento
 * dice cuánto sale de esa tanda (700 g de aderezo).
 */
export function porUnidadDeElaborado(cantidadEnTanda: number, rendimiento: number) {
  const rinde = rendimiento > 0 ? rendimiento : 1;
  return cantidadEnTanda / rinde;
}

/** Formato de plata que sí muestra decimales cuando el costo por unidad es chico. */
export function formatCosto(valor: number) {
  const abs = Math.abs(valor);
  // $8,3333 por gramo necesita decimales; $25.000 por tarro no.
  const decimales = abs > 0 && abs < 100 ? 2 : 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

/**
 * Costo en insumos de un producto, sea suelto o combo. Tipado estructural a
 * propósito: lo usan tanto el servidor (con objetos de Prisma) como la pantalla
 * de Recetas, y así el costo de un combo se calcula igual en ambos lados en vez
 * de escribirse dos veces y desviarse con el tiempo.
 *
 * Un combo suma las recetas de los productos que lo componen, más su propia
 * receta si tiene (el empaque que solo lleva él).
 */
type LineaDeReceta = { cantidad: number; insumo: { costoUnitario: number } };
type ProductoCosteable = {
  recetaItems: LineaDeReceta[];
  comboItems?: { cantidad: number; producto: { recetaItems: LineaDeReceta[] } }[];
};

export function costoDeReceta(items: LineaDeReceta[]) {
  return items.reduce((total, item) => total + item.cantidad * item.insumo.costoUnitario, 0);
}

export function costoDeProducto(producto: ProductoCosteable) {
  const propio = costoDeReceta(producto.recetaItems);
  const componentes = (producto.comboItems ?? []).reduce(
    (total, ci) => total + ci.cantidad * costoDeReceta(ci.producto.recetaItems),
    0
  );
  return propio + componentes;
}

/**
 * Cuánto costó lo que de verdad se consumió, a partir de los movimientos de
 * inventario ligados a ventas.
 *
 * Se restan las ENTRADA porque cancelar un pedido no borra su salida: crea una
 * entrada que la compensa. Contando solo las salidas, la comida de un pedido
 * cancelado quedaba sumada al costo de venta como si se hubiera consumido.
 *
 * Vive aquí y no en cada pantalla porque esta cuenta estaba copiada en cinco
 * archivos, y así fue como nació ese bug: se arregló en uno y los otros
 * siguieron mintiendo.
 */
export type MovimientoValorizable = {
  tipo: string;
  cantidad: number;
  costoUnitario: number | null;
  insumo: { costoUnitario: number };
};

export function costoDeMovimientos(movimientos: MovimientoValorizable[]) {
  return movimientos.reduce((total, m) => {
    const costo = m.cantidad * (m.costoUnitario ?? m.insumo.costoUnitario);
    return m.tipo === "ENTRADA" ? total - costo : total + costo;
  }, 0);
}

export const UNIDAD_LABEL: Record<string, string> = {
  GRAMOS: "g",
  KILOGRAMOS: "kg",
  MILILITROS: "ml",
  LITROS: "l",
  UNIDAD: "unidad",
};
