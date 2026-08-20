import { describe, it, expect } from "vitest";
import {
  costoPorUnidad,
  referenciaDesdeCosto,
  porUnidadDeElaborado,
  costoDeReceta,
  costoDeProducto,
  costoDeMovimientos,
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
