/**
 * Generador de combos y promociones, evaluados contra el margen real.
 *
 * La pregunta que responde no es "¿cuánto descuento doy?" sino **"¿este
 * descuento me deja mejor o peor de como estaba?"**. Y eso depende por completo
 * de algo que casi nadie separa: si el combo hace que la persona compre MÁS, o
 * si solo le abarata lo que iba a comprar de todas formas.
 *
 * Los dos escenarios se calculan siempre, porque el mismo combo puede ser un
 * gran negocio bajo uno y una sangría bajo el otro.
 */

export type ProductoCosteado = {
  id: string;
  nombre: string;
  precio: number;
  /** Costo en insumos. Solo entran productos con receta: ver `esCosteable`. */
  costo: number;
  categoria: string;
};

export type TipoPromo = "COMPLETO" | "PLATO_BEBIDA" | "DOS_PLATOS";

export type Sugerencia = {
  id: string;
  tipo: TipoPromo;
  productos: ProductoCosteado[];
  /** Lo que costaría comprando cada cosa por separado. */
  precioSuelto: number;
  costo: number;
  precioSugerido: number;
  ahorro: number;
  descuentoPct: number;

  /** Lo que te queda con el combo, después de insumos. */
  contribucion: number;
  /** Lo que te quedaría si lo vendieras todo suelto. */
  contribucionSuelta: number;
  costoPct: number;

  /**
   * Escenario A — el cliente ya compraba todo: el combo solo le abarata lo
   * mismo, así que pierdes exactamente el descuento.
   */
  perdidaSiYaCompraba: number;
  /**
   * Cuántas VECES más tienes que vender para compensar esa pérdida. 1,31
   * significa "necesitas un 31% más de ventas solo para quedar igual".
   */
  vecesMasVentas: number;

  /**
   * Escenario B — el cliente solo iba a llevar el plato principal. Aquí el
   * combo suma, porque le vendes cosas que no pensaba llevar.
   */
  contribucionPlatoSolo: number;
  gananciaSiSoloLlevabaElPlato: number;

  /** Verde: el descuento cabe dentro de lo que aguanta el margen. */
  seguro: boolean;
  /** Rojo: el precio no cubre ni los insumos. Nunca. */
  bajoCosto: boolean;
  advertencia: string | null;
};

/** Un producto sin receta no tiene costo conocido, y un costo desconocido no se
 * puede promocionar: aparecería con margen del 100% y el generador
 * recomendaría con total confianza justo las peores promociones. */
export function esCosteable(p: { recetaItems: unknown[]; comboItems?: unknown[]; costo: number }) {
  return p.costo > 0 && (p.recetaItems.length > 0 || (p.comboItems?.length ?? 0) > 0);
}

const CATEGORIAS_PLATO = ["Hamburguesas", "Hot Dogs", "Menú Infantil"];
const CATEGORIA_ACOMPANAMIENTO = "Acompañamientos";
const CATEGORIA_BEBIDA = "Bebidas";

/** A cuánto se redondea un precio para que se vea como precio de carta. */
function redondearPrecio(valor: number) {
  return Math.round(valor / 500) * 500;
}

/**
 * El techo que aguanta un combo: la mitad del margen.
 *
 * Sale de la práctica del sector, y la razón es que por encima de ahí el
 * descuento se come más de lo que cualquier aumento de volumen realista puede
 * reponer. No es una ley física, es dónde deja de compensar.
 */
export function descuentoMaximoSeguro(precioSuelto: number, costo: number) {
  if (precioSuelto <= 0) return 0;
  const margen = (precioSuelto - costo) / precioSuelto;
  return margen / 2;
}

function evaluar(
  tipo: TipoPromo,
  productos: ProductoCosteado[],
  descuento: number
): Sugerencia {
  const precioSuelto = productos.reduce((s, p) => s + p.precio, 0);
  const costo = productos.reduce((s, p) => s + p.costo, 0);

  const precioSugerido = redondearPrecio(precioSuelto * (1 - descuento));
  const ahorro = precioSuelto - precioSugerido;

  const contribucion = precioSugerido - costo;
  const contribucionSuelta = precioSuelto - costo;

  // El plato principal es el primero: es lo que la persona venía a comprar.
  const plato = productos[0]!;
  const contribucionPlatoSolo = plato.precio - plato.costo;

  const bajoCosto = precioSugerido <= costo;
  const techo = descuentoMaximoSeguro(precioSuelto, costo);

  return {
    id: productos.map((p) => p.id).join("+"),
    tipo,
    productos,
    precioSuelto,
    costo,
    precioSugerido,
    ahorro,
    descuentoPct: precioSuelto > 0 ? (ahorro / precioSuelto) * 100 : 0,
    contribucion,
    contribucionSuelta,
    costoPct: precioSugerido > 0 ? (costo / precioSugerido) * 100 : 0,
    perdidaSiYaCompraba: ahorro,
    // Con contribución en cero o negativa, ningún volumen compensa: se marca
    // como Infinity en vez de devolver un número que invitaría a intentarlo.
    vecesMasVentas: contribucion > 0 ? contribucionSuelta / contribucion : Infinity,
    contribucionPlatoSolo,
    gananciaSiSoloLlevabaElPlato: contribucion - contribucionPlatoSolo,
    seguro: !bajoCosto && descuento <= techo,
    bajoCosto,
    advertencia: bajoCosto
      ? "El precio no cubre ni los insumos. Cada venta pierde plata."
      : descuento > techo
        ? `Pasa del techo que aguanta este combo (${(techo * 100).toFixed(0)}%).`
        : null,
  };
}

/**
 * Todas las combinaciones que tienen sentido en una carta, no todas las
 * matemáticamente posibles: juntar dos gaseosas o tres adicionales daría miles
 * de filas que nadie va a leer.
 */
export function generarSugerencias(
  productos: ProductoCosteado[],
  descuento: number
): Sugerencia[] {
  const platos = productos.filter((p) => CATEGORIAS_PLATO.includes(p.categoria));
  const acompanamientos = productos.filter((p) => p.categoria === CATEGORIA_ACOMPANAMIENTO);
  const bebidas = productos.filter((p) => p.categoria === CATEGORIA_BEBIDA);

  const sugerencias: Sugerencia[] = [];

  // Combo completo: lo que la gente entiende por "combo".
  for (const plato of platos)
    for (const acomp of acompanamientos)
      for (const bebida of bebidas) sugerencias.push(evaluar("COMPLETO", [plato, acomp, bebida], descuento));

  for (const plato of platos)
    for (const bebida of bebidas) sugerencias.push(evaluar("PLATO_BEBIDA", [plato, bebida], descuento));

  // Para compartir. Se recorre en pares sin repetir para no generar el mismo
  // dúo dos veces al derecho y al revés.
  for (let i = 0; i < platos.length; i++)
    for (let j = i + 1; j < platos.length; j++)
      sugerencias.push(evaluar("DOS_PLATOS", [platos[i]!, platos[j]!], descuento));

  // Lo que más plata deja arriba: es la única ordenación que importa.
  return sugerencias.sort((a, b) => b.contribucion - a.contribucion);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMOCIONES DEL MISMO PRODUCTO (2x1, 3x2, la segunda a mitad)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un formato "N unidades por el precio de M".
 *
 * Aquí la aritmética es más dura que en un combo, y por una razón que conviene
 * ver de frente: en un combo el descuento se reparte entre productos de costos
 * distintos, y las papas o la gaseosa —baratas y de alto valor percibido—
 * amortiguan. En un 2x1 se entrega el MISMO producto caro dos veces, así que el
 * costo se duplica mientras el ingreso se queda igual.
 *
 * De ahí sale el umbral: un formato aguanta si el costo del producto es menor
 * que `pagadas / entregadas`. Un 2x1 exige costo por debajo del 50%; un 3x2,
 * por debajo del 67%; la segunda a mitad, por debajo del 75%.
 */
export type FormatoMismoProducto = {
  id: string;
  etiqueta: string;
  /** Cuántas se lleva el cliente. */
  entregadas: number;
  /** Cuántas paga, en unidades de precio. 1,5 = la segunda a mitad. */
  pagadas: number;
};

export const FORMATOS_MISMO_PRODUCTO: FormatoMismoProducto[] = [
  { id: "2X1", etiqueta: "2x1", entregadas: 2, pagadas: 1 },
  { id: "3X2", etiqueta: "3x2", entregadas: 3, pagadas: 2 },
  { id: "2DA_MITAD", etiqueta: "La segunda a mitad de precio", entregadas: 2, pagadas: 1.5 },
  { id: "2DA_30", etiqueta: "La segunda con 30% de descuento", entregadas: 2, pagadas: 1.7 },
  { id: "3X2_5", etiqueta: "3 por el precio de 2 y medio", entregadas: 3, pagadas: 2.5 },
];

export type SugerenciaMismoProducto = {
  id: string;
  producto: ProductoCosteado;
  formato: FormatoMismoProducto;

  precioSuelto: number;
  precioPromo: number;
  costo: number;
  ahorro: number;

  contribucion: number;
  /** Lo que dejaría vender UNA sola al precio de siempre. */
  contribucionUnaSola: number;
  /** Escenario bueno: la persona venía por una y se lleva las del formato. */
  gananciaSiSoloLlevabaUna: number;
  /** Escenario malo: ya iba a llevar todas y solo le abarataste. */
  perdidaSiYaLlevabaTodas: number;
  vecesMasVentas: number;

  /** Costo actual del producto sobre su precio. */
  costoPct: number;
  /** El máximo que aguanta ESTE formato: pagadas ÷ entregadas. */
  costoMaximoPct: number;
  /** Margen que sobra (o falta) hasta el umbral, en puntos porcentuales. */
  holguraPuntos: number;

  viable: boolean;
  advertencia: string | null;
};

export function evaluarMismoProducto(
  producto: ProductoCosteado,
  formato: FormatoMismoProducto
): SugerenciaMismoProducto {
  const { entregadas, pagadas } = formato;

  const precioSuelto = producto.precio * entregadas;
  const precioPromo = redondearPrecio(producto.precio * pagadas);
  const costo = producto.costo * entregadas;
  const ahorro = precioSuelto - precioPromo;

  const contribucion = precioPromo - costo;
  const contribucionUnaSola = producto.precio - producto.costo;
  const contribucionSuelta = precioSuelto - costo;

  const costoPct = producto.precio > 0 ? (producto.costo / producto.precio) * 100 : 100;
  const costoMaximoPct = (pagadas / entregadas) * 100;

  const viable = contribucion > 0;

  return {
    id: `${producto.id}:${formato.id}`,
    producto,
    formato,
    precioSuelto,
    precioPromo,
    costo,
    ahorro,
    contribucion,
    contribucionUnaSola,
    gananciaSiSoloLlevabaUna: contribucion - contribucionUnaSola,
    perdidaSiYaLlevabaTodas: ahorro,
    vecesMasVentas: contribucion > 0 ? contribucionSuelta / contribucion : Infinity,
    costoPct,
    costoMaximoPct,
    holguraPuntos: costoMaximoPct - costoPct,
    viable,
    advertencia: !viable
      ? `Un ${formato.etiqueta} entrega ${entregadas} y cobra ${pagadas}: con un costo del ${costoPct.toFixed(0)}% cada venta pierde plata. Este formato aguanta hasta ${costoMaximoPct.toFixed(0)}%.`
      : contribucion < contribucionUnaSola
        ? "Deja menos que vender una sola al precio normal: solo conviene si de verdad trae más gente."
        : null,
  };
}

/** Todas las promos del mismo producto, las mejores primero. */
export function generarPromosMismoProducto(
  productos: ProductoCosteado[],
  formatos: FormatoMismoProducto[] = FORMATOS_MISMO_PRODUCTO
): SugerenciaMismoProducto[] {
  const todas: SugerenciaMismoProducto[] = [];
  for (const p of productos) for (const f of formatos) todas.push(evaluarMismoProducto(p, f));
  return todas.sort((a, b) => b.contribucion - a.contribucion);
}

export const ETIQUETA_TIPO: Record<TipoPromo, string> = {
  COMPLETO: "Plato + acompañamiento + bebida",
  PLATO_BEBIDA: "Plato + bebida",
  DOS_PLATOS: "Dos platos",
};
