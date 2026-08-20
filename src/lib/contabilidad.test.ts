import { describe, it, expect } from "vitest";
import { construirCascada } from "./contabilidad";

/** Los números reales de agosto 2026, que es donde apareció el bug. */
const AGOSTO = {
  ventas: 80000,
  costoVenta: 33923,
  utilidadBruta: 46077,
  gastosFijos: 900000,
  gastosDelMes: 0,
  mermas: 0,
  utilidadNeta: -853923,
};

describe("construirCascada", () => {
  it("cada tramo arranca donde terminó el anterior", () => {
    const c = construirCascada(AGOSTO);
    const insumos = c.find((t) => t.nombre === "Insumos")!;
    expect(insumos.rango[1]).toBe(AGOSTO.ventas);
    expect(insumos.rango[0]).toBe(AGOSTO.ventas - AGOSTO.costoVenta);
  });

  it("una utilidad negativa se dibuja HACIA ABAJO, cruzando el cero", () => {
    // EL BUG: la barra se apilaba sobre una base transparente, y una base no
    // sabe bajar de cero. La pérdida de $853.923 se dibujaba hacia arriba, con
    // la misma forma que tendría una ganancia de esa cifra.
    const neta = construirCascada(AGOSTO).find((t) => t.nombre === "Utilidad neta")!;
    expect(neta.rango).toEqual([0, -853923]);
    expect(Math.min(...neta.rango)).toBeLessThan(0);
  });

  it("el monto de la utilidad conserva su signo", () => {
    // De aquí sale la etiqueta que se imprime encima de la barra.
    const neta = construirCascada(AGOSTO).find((t) => t.nombre === "Utilidad neta")!;
    expect(neta.monto).toBe(-853923);
  });

  it("los egresos van firmados en negativo", () => {
    const c = construirCascada(AGOSTO);
    expect(c.find((t) => t.nombre === "Insumos")!.monto).toBe(-33923);
    expect(c.find((t) => t.nombre === "Fijos")!.monto).toBe(-900000);
  });

  it("las ventas entran en positivo desde cero", () => {
    const ventas = construirCascada(AGOSTO).find((t) => t.nombre === "Ventas")!;
    expect(ventas.rango).toEqual([0, 80000]);
    expect(ventas.rol).toBe("entra");
  });

  it("omite los tramos en cero para no meter barras invisibles", () => {
    const nombres = construirCascada(AGOSTO).map((t) => t.nombre);
    expect(nombres).not.toContain("Gastos");
    expect(nombres).not.toContain("Mermas");
  });

  it("incluye gastos y mermas cuando los hay, en cadena", () => {
    const c = construirCascada({
      ventas: 1000000,
      costoVenta: 300000,
      utilidadBruta: 700000,
      gastosFijos: 200000,
      gastosDelMes: 100000,
      mermas: 50000,
      utilidadNeta: 350000,
    });
    const fijos = c.find((t) => t.nombre === "Fijos")!;
    const gastos = c.find((t) => t.nombre === "Gastos")!;
    const mermas = c.find((t) => t.nombre === "Mermas")!;
    // Cada uno arranca donde acabó el anterior.
    expect(fijos.rango).toEqual([500000, 700000]);
    expect(gastos.rango).toEqual([400000, 500000]);
    expect(mermas.rango).toEqual([350000, 400000]);
  });

  it("un mes rentable termina en positivo", () => {
    const neta = construirCascada({
      ventas: 3000000,
      costoVenta: 1085000,
      utilidadBruta: 1915000,
      gastosFijos: 900000,
      gastosDelMes: 0,
      mermas: 0,
      utilidadNeta: 1015000,
    }).find((t) => t.nombre === "Utilidad neta")!;
    expect(neta.rango).toEqual([0, 1015000]);
    expect(neta.monto).toBeGreaterThan(0);
  });

  it("el último tramo siempre cierra donde dice la utilidad neta", () => {
    // Propiedad general: la cascada no puede terminar en un sitio distinto al
    // que dice el estado de resultados.
    for (const caso of [AGOSTO, { ...AGOSTO, gastosDelMes: 12345, utilidadNeta: -866268 }]) {
      const c = construirCascada(caso);
      expect(c[c.length - 1]!.monto).toBe(caso.utilidadNeta);
    }
  });
});
