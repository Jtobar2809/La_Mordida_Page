import { describe, it, expect } from "vitest";
import {
  costoPorUnidad,
  referenciaDesdeCosto,
  porUnidadDeElaborado,
  costoDeReceta,
  costoDeProducto,
  costoDeMovimientos,
  clasificarConsumo,
  redondearCosto,
  redondearCantidad,
} from "./costos";

describe("costoPorUnidad", () => {
  it("divide el precio pagado entre la cantidad que llegó", () => {
    // El tarro de 3.000 g a $25.000: el gramo cuesta $8,33, no $8.
    expect(costoPorUnidad(25000, 3000)).toBeCloseTo(8.3333, 4);
    expect(costoPorUnidad(29000, 4000)).toBe(7.25);
  });

  it("trata una cantidad de 0 como 1 en vez de dividir por cero", () => {
    // Un formulario a medio llenar no puede producir Infinity y contaminar
    // todos los costos aguas abajo.
    expect(costoPorUnidad(5000, 0)).toBe(5000);
    expect(Number.isFinite(costoPorUnidad(5000, 0))).toBe(true);
  });

  it("no pierde los decimales que importan", () => {
    // Con enteros esto daba $8/g y el error se multiplicaba por cada gramo de
    // cada receta: 3.000 g salían en $24.000 en vez de $25.000.
    const porGramo = costoPorUnidad(25000, 3000);
    expect(porGramo * 3000).toBeCloseTo(25000, 0);
  });
});

describe("referenciaDesdeCosto", () => {
  it("deja el par precio/cantidad coherente con el costo calculado", () => {
    // Cuando una compra recalcula el promedio ponderado, el formulario del
    // insumo tiene que mostrar ese precio — si no, al guardarlo lo pisaría.
    const r = referenciaDesdeCosto(7.25, 4000);
    expect(r.costoUnitario).toBe(7.25);
    expect(r.precioReferencia).toBe(29000);
    expect(r.cantidadReferencia).toBe(4000);
  });

  it("usa 1 como cantidad cuando la guardada es inválida", () => {
    expect(referenciaDesdeCosto(500, 0).cantidadReferencia).toBe(1);
  });
});

describe("porUnidadDeElaborado", () => {
  it("baja la cantidad de la tanda a por-unidad", () => {
    // 400 g de mayonesa en una tanda de aderezo que rinde 800 ml = 0,5 por ml.
    expect(porUnidadDeElaborado(400, 800)).toBe(0.5);
  });

  it("con rendimiento 1 la composición significa lo mismo que antes", () => {
    // La migración dejó rendimiento en 1 justamente para no mover ningún costo
    // existente. Esta prueba protege esa promesa.
    expect(porUnidadDeElaborado(37, 1)).toBe(37);
  });

  it("un rendimiento en 0 no revienta el cálculo", () => {
    expect(porUnidadDeElaborado(100, 0)).toBe(100);
  });
});

describe("costoDeProducto", () => {
  const receta = (...pares: [number, number][]) =>
    pares.map(([cantidad, costoUnitario]) => ({ cantidad, insumo: { costoUnitario } }));

  it("suma la receta de un producto suelto", () => {
    expect(costoDeReceta(receta([130, 28], [1, 1533.33]))).toBeCloseTo(5173.33, 2);
  });

  it("un combo cuesta lo que cuestan los productos que lo componen", () => {
    // La Clásica ($7.258) + papas ($1.670) + gaseosa ($1.250) = $10.178.
    const combo = {
      recetaItems: [],
      comboItems: [
        { cantidad: 1, producto: { recetaItems: receta([1, 7258]) } },
        { cantidad: 1, producto: { recetaItems: receta([1, 1670]) } },
        { cantidad: 1, producto: { recetaItems: receta([1, 1250]) } },
      ],
    };
    expect(costoDeProducto(combo)).toBe(10178);
  });

  it("multiplica por la cantidad de cada componente", () => {
    const combo = {
      recetaItems: [],
      comboItems: [{ cantidad: 2, producto: { recetaItems: receta([1, 1250]) } }],
    };
    expect(costoDeProducto(combo)).toBe(2500);
  });

  it("suma la receta propia del combo además de sus componentes", () => {
    // El empaque que solo lleva el combo.
    const combo = {
      recetaItems: receta([1, 200]),
      comboItems: [{ cantidad: 1, producto: { recetaItems: receta([1, 1000]) } }],
    };
    expect(costoDeProducto(combo)).toBe(1200);
  });

  it("un producto sin comboItems no falla", () => {
    expect(costoDeProducto({ recetaItems: receta([2, 50]) })).toBe(100);
  });
});

describe("costoDeMovimientos", () => {
  const mov = (tipo: string, cantidad: number, costoUnitario: number | null, respaldo = 0) => ({
    tipo,
    cantidad,
    costoUnitario,
    insumo: { costoUnitario: respaldo },
  });

  it("suma las salidas", () => {
    expect(costoDeMovimientos([mov("SALIDA", 130, 28), mov("SALIDA", 1, 1533)])).toBe(5173);
  });

  it("resta las entradas que revierten un pedido cancelado", () => {
    // EL BUG DE PRODUCCIÓN: contando solo las salidas, un pedido cancelado de
    // $28.000 sumaba los $16.208 de su receta al costo de venta y hundía el
    // margen bruto sin ninguna causa visible.
    const movimientos = [
      mov("SALIDA", 260, 28), // 2x Crunch, entregado
      mov("SALIDA", 390, 28), // Triple Impacto, después cancelado
      mov("ENTRADA", 390, 28), // su reversión
    ];
    expect(costoDeMovimientos(movimientos)).toBe(260 * 28);
  });

  it("aguanta un pedido cancelado y vuelto a confirmar", () => {
    // salida, reversión, salida otra vez = una sola salida neta.
    expect(costoDeMovimientos([mov("SALIDA", 100, 10), mov("ENTRADA", 100, 10), mov("SALIDA", 100, 10)])).toBe(1000);
  });

  it("usa el costo del insumo cuando el movimiento no guardó el suyo", () => {
    expect(costoDeMovimientos([mov("SALIDA", 10, null, 5)])).toBe(50);
  });

  it("sin movimientos el costo es cero, no NaN", () => {
    expect(costoDeMovimientos([])).toBe(0);
  });
});

describe("redondeos", () => {
  it("redondearCosto conserva 4 decimales", () => {
    expect(redondearCosto(8.333333)).toBe(8.3333);
  });

  it("redondearCantidad conserva 2", () => {
    expect(redondearCantidad(2545.678)).toBe(2545.68);
  });

  it("un valor no finito se vuelve 0 en vez de propagarse", () => {
    expect(redondearCosto(Infinity)).toBe(0);
    expect(redondearCantidad(NaN)).toBe(0);
  });
});

describe("clasificarConsumo", () => {
  const m = (
    tipo: string,
    cantidad: number,
    costoUnitario: number | null,
    extra: { orderId?: string | null; produccionId?: string | null; costoInsumo?: number } = {}
  ) => ({
    tipo,
    cantidad,
    costoUnitario,
    orderId: extra.orderId ?? null,
    produccionId: extra.produccionId ?? null,
    insumo: { costoUnitario: extra.costoInsumo ?? 0 },
  });

  it("EL BUG: los desechables se consumían y no aparecían en ningún lado", () => {
    // 200 bolsas a $150 salieron del stock con `registrarConsumoManual`, sin
    // pedido detrás. `costoDeMovimientos` no las veía y el estado de resultados
    // reportaba $30.000 de utilidad que no existían.
    const bolsas = [m("SALIDA", 200, 150)];
    expect(costoDeMovimientos(bolsas)).toBe(30000); // la función vieja sí las suma...
    // ...pero el P&L filtraba `orderId: { not: null }` antes de llamarla, así
    // que nunca le llegaban. Ahora llegan y caen en su propio renglón.
    expect(clasificarConsumo(bolsas).venta).toBe(0);
    expect(clasificarConsumo(bolsas).operacion).toBe(30000);
  });

  it("separa lo que se fue en ventas de lo que se fue en desechables", () => {
    const d = clasificarConsumo([
      m("SALIDA", 260, 28, { orderId: "ped_1" }),
      m("SALIDA", 200, 150),
    ]);
    expect(d.venta).toBe(260 * 28);
    expect(d.operacion).toBe(30000);
  });

  it("una anulación devuelve costo de venta, no suma consumo de operación", () => {
    const d = clasificarConsumo([
      m("SALIDA", 390, 28, { orderId: "ped_2" }),
      m("ENTRADA", 390, 28, { orderId: "ped_2" }),
    ]);
    expect(d.venta).toBe(0);
    expect(d.operacion).toBe(0);
  });

  it("una compra es una ENTRADA sin pedido, y no es consumo", () => {
    expect(clasificarConsumo([m("ENTRADA", 3000, 8.3333)]).salidaNeta).toBe(0);
  });

  it("preparar un elaborado mueve valor, no lo gasta", () => {
    // 400 g de mayonesa entran a una tanda de aderezo: los componentes salen y
    // el elaborado entra por el mismo valor. Contarlo sería cobrar dos veces la
    // misma mayonesa: una al prepararla y otra al vender la hamburguesa.
    const d = clasificarConsumo([
      m("SALIDA", 400, 20, { produccionId: "prod_1" }),
      m("PRODUCCION", 700, 11.4286, { produccionId: "prod_1" }),
    ]);
    expect(d.venta).toBe(0);
    expect(d.operacion).toBe(0);
    expect(d.salidaNeta).toBe(0);
  });

  it("mermas y ajustes negativos son pérdida; el signo lo pone el bucket", () => {
    const d = clasificarConsumo([
      m("MERMA", 500, 28),
      m("AJUSTE", -120, 28), // el conteo encontró menos de lo esperado
    ]);
    expect(d.perdidas).toBe(500 * 28 + 120 * 28);
  });

  it("un ajuste hacia arriba no borra la merma, pero sí cuadra el inventario", () => {
    // El reporte de mermas mide lo que se perdió, no el neto: si se netearan,
    // un conteo generoso taparía una merma real. Pero la despensa sí tiene ese
    // insumo de más, así que la variación de inventario tiene que verlo.
    const d = clasificarConsumo([m("MERMA", 100, 10), m("AJUSTE", 40, 10)]);
    expect(d.perdidas).toBe(1000);
    expect(d.ajustesPositivos).toBe(400);
    expect(d.salidaNeta).toBe(600);
  });

  it("salidaNeta suma las tres razones por las que baja el stock", () => {
    const d = clasificarConsumo([
      m("SALIDA", 10, 100, { orderId: "ped_3" }),
      m("SALIDA", 5, 100),
      m("MERMA", 2, 100),
    ]);
    expect(d.salidaNeta).toBe(1700);
  });

  it("cae al costo del insumo cuando el movimiento no guardó el suyo", () => {
    expect(clasificarConsumo([m("SALIDA", 10, null, { costoInsumo: 5 })]).operacion).toBe(50);
  });

  it("sin movimientos todo es cero, no NaN", () => {
    expect(clasificarConsumo([])).toEqual({
      venta: 0,
      operacion: 0,
      perdidas: 0,
      ajustesPositivos: 0,
      salidaNeta: 0,
    });
  });
});
