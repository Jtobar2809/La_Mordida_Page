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

export const ETIQUETA_TIPO: Record<TipoPromo, string> = {
  COMPLETO: "Plato + acompañamiento + bebida",
  PLATO_BEBIDA: "Plato + bebida",
  DOS_PLATOS: "Dos platos",
};
