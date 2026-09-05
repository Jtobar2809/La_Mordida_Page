import { describe, it, expect } from "vitest";
import { construirFlujo, construirPuente, type CifrasFlujo, type FlujoDelMes } from "./flujo";
import type { EstadoResultados } from "./contabilidad";

const CIFRAS: CifrasFlujo = {
  ventasCobradas: 8_450_000,
  otrosIngresos: 150_000,
  compras: 4_200_000,
  fijos: 1_600_000,
  gastos: 1_310_000,
  retiros: 800_000,
  otrasSalidas: 0,
};

describe("construirFlujo", () => {
  it("las compras salen de la misma bolsa que el arriendo", () => {
    // La razón de ser del archivo: acá una compra no es un renglón aparte con
    // asterisco, es una salida como cualquier otra.
    const f = construirFlujo(CIFRAS);
    const compras = f.salidas.find((l) => l.etiqueta === "Compras a proveedores")!;
    expect(compras.monto).toBe(4_200_000);
    expect(f.totalSalidas).toBe(4_200_000 + 1_600_000 + 1_310_000 + 800_000);
  });

  it("quedó = entró − salió", () => {
    const f = construirFlujo(CIFRAS);
    expect(f.totalEntradas).toBe(8_600_000);
    expect(f.neto).toBe(f.totalEntradas - f.totalSalidas);
    expect(f.neto).toBe(690_000);
  });

  it("el mes que se llena la despensa da negativo, y está bien", () => {
    // No es un caso patológico: es enero, cuando se compra para todo el año.
    // La plata salió de verdad y la pantalla tiene que decirlo, aunque el
    // estado de resultados —que sí sabe de inventario— muestre utilidad.
    const f = construirFlujo({ ...CIFRAS, compras: 9_000_000 });
    expect(f.neto).toBeLessThan(0);
  });

  it("no dibuja renglones en cero", () => {
    const f = construirFlujo({ ...CIFRAS, otrosIngresos: 0, retiros: 0 });
    expect(f.entradas.map((l) => l.etiqueta)).toEqual(["Ventas cobradas"]);
    expect(f.salidas.some((l) => l.etiqueta === "Retiros de socios")).toBe(false);
  });

  it("sin nada registrado, todo en cero y sin líneas", () => {
    const vacio = construirFlujo({
      ventasCobradas: 0,
      otrosIngresos: 0,
      compras: 0,
      fijos: 0,
      gastos: 0,
      retiros: 0,
      otrasSalidas: 0,
    });
    expect(vacio.entradas).toEqual([]);
    expect(vacio.salidas).toEqual([]);
    expect(vacio.neto).toBe(0);
  });
});

/**
 * Un mes coherente entre los dos libros, para poder verificar el puente.
 *
 * Los números están escogidos para que las dos vistas se contradigan de la
 * forma en que se contradicen en la vida real: se compró más de lo que se
 * consumió, así que hay utilidad y aun así salió más plata de la que entró.
 */
const ESTADO = {
  domicilios: 200_000,
  impuestos: 0,
  ventas: 8_250_000,
  costoVenta: 2_900_000,
  consumoOperacion: 180_000,
  mermas: 60_000,
  gastosFijos: CIFRAS.fijos,
  gastosDelMes: CIFRAS.gastos,
  retiroReal: CIFRAS.retiros,
  ajustesPositivos: 40_000,
  // compras − (costoVenta + operación + mermas − ajustes)
  variacionInventario: 4_200_000 - (2_900_000 + 180_000 + 60_000 - 40_000),
} as EstadoResultados;

const UTILIDAD_NETA =
  ESTADO.ventas - ESTADO.costoVenta - ESTADO.consumoOperacion - ESTADO.gastosFijos - ESTADO.gastosDelMes - ESTADO.mermas;

describe("construirPuente", () => {
  const flujo = { ...CIFRAS, ...construirFlujo(CIFRAS) } as FlujoDelMes;

  it("la utilidad más el puente da exactamente la plata que quedó", () => {
    // Esta es LA prueba del archivo. Si un día deja de cuadrar, el panel está
    // mostrando dos cifras que no se pueden reconciliar y el dueño no tiene
    // forma de saber cuál creer.
    const quedaEnNegocio = UTILIDAD_NETA - ESTADO.retiroReal;
    const puente = construirPuente(flujo, ESTADO);
    const suma = puente.reduce((s, l) => s + l.monto, quedaEnNegocio);

    expect(suma).toBe(flujo.neto);
  });

  it("nombra la despensa como lo que separa las dos cifras", () => {
    const despensa = construirPuente(flujo, ESTADO).find((l) => l.etiqueta === "Se quedó en la despensa")!;
    // Signo negativo: la utilidad no lo restó, la plata sí salió.
    expect(despensa.monto).toBe(-ESTADO.variacionInventario);
    expect(despensa.monto).toBeLessThan(0);
  });

  it("cuando se come despensa vieja, el renglón cambia de signo y de explicación", () => {
    const comiendoDespensa = { ...ESTADO, variacionInventario: -500_000 } as EstadoResultados;
    const linea = construirPuente(flujo, comiendoDespensa).find((l) => l.etiqueta === "Se quedó en la despensa")!;
    expect(linea.monto).toBe(500_000);
    expect(linea.detalle).toContain("ya tenías");
  });

  it("un mes sin diferencias no muestra puente", () => {
    const sinDiferencias = {
      ...ESTADO,
      domicilios: 0,
      impuestos: 0,
      variacionInventario: 0,
      ajustesPositivos: 0,
    } as EstadoResultados;
    const flujoLimpio = {
      ...CIFRAS,
      otrosIngresos: 0,
      otrasSalidas: 0,
      ...construirFlujo({ ...CIFRAS, otrosIngresos: 0 }),
    } as FlujoDelMes;

    expect(construirPuente(flujoLimpio, sinDiferencias)).toEqual([]);
  });
});
