import { describe, it, expect } from "vitest";
import {
  generarSugerencias,
  descuentoMaximoSeguro,
  evaluarMismoProducto,
  generarPromosMismoProducto,
  FORMATOS_MISMO_PRODUCTO,
  calcularDescuentoPromos,
  reglaVigente,
  type ProductoCosteado,
} from "./promociones";

/** Productos reales de La Mordida, con sus costos de agosto 2026. */
const CLASICA: ProductoCosteado = { id: "cl", nombre: "La Clásica", precio: 20000, costo: 7258, categoria: "Hamburguesas" };
const MORDIDA: ProductoCosteado = { id: "mo", nombre: "La Mordida", precio: 32000, costo: 9617, categoria: "Hamburguesas" };
const TRIPLE: ProductoCosteado = { id: "tr", nombre: "Triple Impacto", precio: 28000, costo: 16208, categoria: "Hamburguesas" };
const PAPAS: ProductoCosteado = { id: "pa", nombre: "Papas", precio: 9000, costo: 1670, categoria: "Acompañamientos" };
const GASEOSA: ProductoCosteado = { id: "ga", nombre: "Gaseosa", precio: 4000, costo: 1250, categoria: "Bebidas" };

const CARTA = [CLASICA, MORDIDA, TRIPLE, PAPAS, GASEOSA];

describe("generarSugerencias", () => {
  it("arma combos completos, plato+bebida y dos platos", () => {
    const s = generarSugerencias(CARTA, 0.15);
    const tipos = new Set(s.map((x) => x.tipo));
    expect(tipos).toEqual(new Set(["COMPLETO", "PLATO_BEBIDA", "DOS_PLATOS"]));
    // 3 platos × 1 acompañamiento × 1 bebida = 3 completos.
    expect(s.filter((x) => x.tipo === "COMPLETO")).toHaveLength(3);
    // 3 platos tomados de a 2 = 3 parejas, sin repetir al derecho y al revés.
    expect(s.filter((x) => x.tipo === "DOS_PLATOS")).toHaveLength(3);
  });

  it("ordena por lo que más plata deja, no por precio", () => {
    const s = generarSugerencias(CARTA, 0.15);
    for (let i = 1; i < s.length; i++) {
      expect(s[i - 1]!.contribucion).toBeGreaterThanOrEqual(s[i]!.contribucion);
    }
  });

  it("no repite la misma pareja de platos invertida", () => {
    const parejas = generarSugerencias(CARTA, 0.15).filter((x) => x.tipo === "DOS_PLATOS");
    const normalizadas = parejas.map((p) => p.productos.map((x) => x.id).sort().join("|"));
    expect(new Set(normalizadas).size).toBe(parejas.length);
  });

  it("nunca mete un producto sin costo, porque no se le puede confiar el margen", () => {
    const sinCosto: ProductoCosteado = { id: "ar", nombre: "Aros", precio: 10000, costo: 0, categoria: "Acompañamientos" };
    // El generador recibe solo productos costeados; si igual entrara uno en
    // cero, quedaría con contribución del 100% y encabezaría el ranking.
    const s = generarSugerencias([CLASICA, sinCosto, GASEOSA], 0.15);
    const conAros = s.find((x) => x.productos.some((p) => p.id === "ar"));
    expect(conAros?.costoPct).toBeLessThan(100);
  });
});

describe("la aritmética del descuento", () => {
  it("calcula cuántas veces más hay que vender para compensar", () => {
    // La Clásica sola: aporta $12.742. Con $3.000 de descuento aporta $9.742.
    // 12.742 / 9.742 = 1,31 → hace falta un 31% más de ventas para quedar igual.
    const [combo] = generarSugerencias([CLASICA], 0);
    void combo;
    const soloClasica = generarSugerencias([CLASICA, GASEOSA], 0.125).find((x) => x.tipo === "PLATO_BEBIDA")!;
    expect(soloClasica.vecesMasVentas).toBeGreaterThan(1);
    // La cuenta es contribución suelta ÷ contribución con descuento.
    expect(soloClasica.vecesMasVentas).toBeCloseTo(
      soloClasica.contribucionSuelta / soloClasica.contribucion,
      6
    );
  });

  it("separa los dos escenarios, que es lo que decide si el combo sirve", () => {
    const combo = generarSugerencias(CARTA, 0.15).find(
      (x) => x.tipo === "COMPLETO" && x.productos[0]!.id === "cl"
    )!;
    // Si ya compraba todo: pierdes exactamente el descuento.
    expect(combo.perdidaSiYaCompraba).toBe(combo.ahorro);
    // Si solo llevaba la hamburguesa: ganas lo que aportan papas y gaseosa
    // menos el descuento. Con 15% eso sigue siendo positivo.
    expect(combo.gananciaSiSoloLlevabaElPlato).toBeGreaterThan(0);
    expect(combo.gananciaSiSoloLlevabaElPlato).toBe(combo.contribucion - combo.contribucionPlatoSolo);
  });

  it("marca en rojo un descuento que no cubre ni los insumos", () => {
    // 90% de descuento sobre el Triple Impacto, que ya es el de peor margen.
    const s = generarSugerencias([TRIPLE, GASEOSA], 0.9).find((x) => x.tipo === "PLATO_BEBIDA")!;
    expect(s.bajoCosto).toBe(true);
    expect(s.seguro).toBe(false);
    expect(s.advertencia).toMatch(/no cubre/i);
    // Sin contribución positiva, ningún volumen compensa.
    expect(s.vecesMasVentas).toBe(Infinity);
  });

  it("avisa cuando el descuento pasa del techo que aguanta el combo", () => {
    const s = generarSugerencias([TRIPLE, GASEOSA], 0.4).find((x) => x.tipo === "PLATO_BEBIDA")!;
    expect(s.seguro).toBe(false);
    expect(s.advertencia).toMatch(/techo/i);
    // Pero todavía cubre los insumos: es advertencia, no prohibición.
    expect(s.bajoCosto).toBe(false);
  });

  it("un descuento moderado sobre un buen margen queda en verde", () => {
    const s = generarSugerencias([MORDIDA, PAPAS, GASEOSA], 0.15).find((x) => x.tipo === "COMPLETO")!;
    expect(s.seguro).toBe(true);
    expect(s.advertencia).toBeNull();
  });

  it("redondea a múltiplos de 500 para que parezca precio de carta", () => {
    for (const s of generarSugerencias(CARTA, 0.13)) {
      expect(s.precioSugerido % 500).toBe(0);
    }
  });
});

describe("descuentoMaximoSeguro", () => {
  it("es la mitad del margen", () => {
    // $33.000 de precio con $10.178 de costo = 69,2% de margen -> techo 34,6%.
    expect(descuentoMaximoSeguro(33000, 10178)).toBeCloseTo(0.3458, 3);
  });

  it("un producto de mal margen aguanta mucho menos descuento", () => {
    const bueno = descuentoMaximoSeguro(MORDIDA.precio, MORDIDA.costo);
    const malo = descuentoMaximoSeguro(TRIPLE.precio, TRIPLE.costo);
    expect(malo).toBeLessThan(bueno);
  });

  it("sin precio no hay techo que calcular", () => {
    expect(descuentoMaximoSeguro(0, 0)).toBe(0);
  });
});

describe("promociones del mismo producto", () => {
  const formato = (id: string) => FORMATOS_MISMO_PRODUCTO.find((f) => f.id === id)!;

  it("un 2x1 aguanta hasta 50% de costo, ni un punto más", () => {
    // Es la aritmética entera del formato: entregas 2, cobras 1, así que el
    // costo del par tiene que caber dentro de un solo precio.
    const s = evaluarMismoProducto(MORDIDA, formato("2X1"));
    expect(s.costoMaximoPct).toBe(50);
  });

  it("La Mordida sí aguanta un 2x1", () => {
    // 30% de costo: $32.000 − 2×$9.617 = $12.766 y sigue dejando plata.
    const s = evaluarMismoProducto(MORDIDA, formato("2X1"));
    expect(s.viable).toBe(true);
    expect(s.contribucion).toBe(32000 - 2 * 9617);
    expect(s.holguraPuntos).toBeGreaterThan(0);
  });

  it("Triple Impacto NO aguanta un 2x1: cada venta pierde plata", () => {
    // 58% de costo contra un techo de 50%. $28.000 − 2×$16.208 = −$4.416.
    const s = evaluarMismoProducto(TRIPLE, formato("2X1"));
    expect(s.viable).toBe(false);
    expect(s.contribucion).toBeLessThan(0);
    expect(s.holguraPuntos).toBeLessThan(0);
    expect(s.advertencia).toMatch(/pierde plata/i);
    expect(s.vecesMasVentas).toBe(Infinity);
  });

  it("el mismo producto que falla en 2x1 puede pasar en 3x2", () => {
    // 3x2 exige costo bajo 67%, y el Triple está en 58%.
    const dosPorUno = evaluarMismoProducto(TRIPLE, formato("2X1"));
    const tresPorDos = evaluarMismoProducto(TRIPLE, formato("3X2"));
    expect(dosPorUno.viable).toBe(false);
    expect(tresPorDos.viable).toBe(true);
    expect(tresPorDos.costoMaximoPct).toBeCloseTo(66.67, 1);
  });

  it("la segunda a mitad de precio es el formato más permisivo de los de dos", () => {
    expect(evaluarMismoProducto(MORDIDA, formato("2DA_MITAD")).costoMaximoPct).toBe(75);
    expect(evaluarMismoProducto(MORDIDA, formato("2DA_30")).costoMaximoPct).toBe(85);
  });

  it("avisa cuando la promo deja menos que vender una sola", () => {
    // La Clásica en 2x1: $20.000 − 2×$7.258 = $5.484, contra $12.742 de una
    // sola. No pierde plata, pero solo compensa si trae gente nueva.
    const s = evaluarMismoProducto(CLASICA, formato("2X1"));
    expect(s.viable).toBe(true);
    expect(s.contribucion).toBeLessThan(s.contribucionUnaSola);
    expect(s.advertencia).toMatch(/menos que vender una sola/i);
  });

  it("separa los dos escenarios igual que los combos", () => {
    const s = evaluarMismoProducto(MORDIDA, formato("2X1"));
    expect(s.perdidaSiYaLlevabaTodas).toBe(s.ahorro);
    expect(s.gananciaSiSoloLlevabaUna).toBe(s.contribucion - s.contribucionUnaSola);
  });

  it("genera cada producto contra cada formato, mejores primero", () => {
    const s = generarPromosMismoProducto([MORDIDA, TRIPLE]);
    expect(s).toHaveLength(2 * FORMATOS_MISMO_PRODUCTO.length);
    for (let i = 1; i < s.length; i++) {
      expect(s[i - 1]!.contribucion).toBeGreaterThanOrEqual(s[i]!.contribucion);
    }
  });
});

describe("calcularDescuentoPromos", () => {
  const dosPorUno = { id: "r1", productId: "mo", nombre: "2x1 La Mordida", entregadas: 2, pagadas: 1 };
  const tresPorDos = { id: "r2", productId: "mo", nombre: "3x2 La Mordida", entregadas: 3, pagadas: 2 };
  const segundaMitad = { id: "r3", productId: "mo", nombre: "2da a mitad", entregadas: 2, pagadas: 1.5 };
  const linea = (cantidad: number, productId = "mo", precioUnitario = 32000) => ({ productId, cantidad, precioUnitario });

  it("un 2x1 con 2 unidades descuenta una", () => {
    const r = calcularDescuentoPromos([linea(2)], [dosPorUno]);
    expect(r.descuento).toBe(32000);
    expect(r.aplicadas[0]!.veces).toBe(1);
  });

  it("con 1 unidad no aplica nada", () => {
    expect(calcularDescuentoPromos([linea(1)], [dosPorUno]).descuento).toBe(0);
  });

  it("en un 2x1, pedir 5 paga 3", () => {
    // 2 grupos completos + 1 suelta: se descuentan 2.
    const r = calcularDescuentoPromos([linea(5)], [dosPorUno]);
    expect(r.descuento).toBe(2 * 32000);
    expect(r.aplicadas[0]!.veces).toBe(2);
  });

  it("en un 3x2, pedir 7 descuenta 2", () => {
    const r = calcularDescuentoPromos([linea(7)], [tresPorDos]);
    expect(r.descuento).toBe(2 * 32000);
  });

  it("la segunda a mitad descuenta medio precio", () => {
    const r = calcularDescuentoPromos([linea(2)], [segundaMitad]);
    expect(r.descuento).toBe(16000);
  });

  it("agrupa por producto aunque vengan en líneas separadas", () => {
    // Dos líneas de una unidad son dos unidades: si el 2x1 solo mirara dentro
    // de cada línea, pedirlas por separado dejaría al cliente sin promoción.
    const r = calcularDescuentoPromos([linea(1), linea(1)], [dosPorUno]);
    expect(r.descuento).toBe(32000);
  });

  it("no toca productos que no tienen regla", () => {
    const r = calcularDescuentoPromos([linea(4, "otro", 20000)], [dosPorUno]);
    expect(r.descuento).toBe(0);
    expect(r.aplicadas).toHaveLength(0);
  });

  it("con dos reglas para el mismo producto gana la que más favorece al cliente", () => {
    // Cobrar la menos generosa después de anunciar la otra es la clase de
    // sorpresa que hace que la gente no vuelva.
    const r = calcularDescuentoPromos([linea(6)], [tresPorDos, dosPorUno]);
    // 2x1 sobre 6 descuenta 3; 3x2 sobre 6 descuenta 2. Gana el 2x1.
    expect(r.descuento).toBe(3 * 32000);
    expect(r.aplicadas[0]!.reglaId).toBe("r1");
  });

  it("ignora una regla que no descuenta nada o que regala de más", () => {
    const absurda = { id: "x", productId: "mo", nombre: "2x2", entregadas: 2, pagadas: 2 };
    const imposible = { id: "y", productId: "mo", nombre: "1x2", entregadas: 1, pagadas: 2 };
    expect(calcularDescuentoPromos([linea(4)], [absurda]).descuento).toBe(0);
    expect(calcularDescuentoPromos([linea(4)], [imposible]).descuento).toBe(0);
  });

  it("sin reglas el descuento es cero, no NaN", () => {
    expect(calcularDescuentoPromos([linea(3)], []).descuento).toBe(0);
  });
});

describe("reglaVigente", () => {
  const base = { activa: true, desde: null, hasta: null };
  const dia = (d: number) => new Date(2026, 7, d);

  it("una regla activa sin fechas rige siempre", () => {
    expect(reglaVigente(base, dia(15))).toBe(true);
  });

  it("una regla desactivada no rige aunque esté en fecha", () => {
    expect(reglaVigente({ ...base, activa: false }, dia(15))).toBe(false);
  });

  it("respeta el inicio y el fin de la vigencia", () => {
    const r = { ...base, desde: dia(10), hasta: dia(20) };
    expect(reglaVigente(r, dia(9))).toBe(false);
    expect(reglaVigente(r, dia(15))).toBe(true);
    expect(reglaVigente(r, dia(21))).toBe(false);
  });
});
