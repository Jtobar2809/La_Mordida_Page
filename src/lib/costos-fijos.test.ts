import { describe, it, expect } from "vitest";
import { inicioDeMes, estaVigenteEn, repartirFijos } from "./costos-fijos";

const mes = (anio: number, m: number) => ({ desde: new Date(anio, m - 1, 1), hasta: new Date(anio, m, 1) });

/** El arriendo subió de $1.200.000 a $1.400.000 a partir de octubre. */
const VIEJO = { vigenteDesde: new Date(2026, 0, 1), vigenteHasta: new Date(2026, 9, 1) };
const NUEVO = { vigenteDesde: new Date(2026, 9, 1), vigenteHasta: null };

describe("estaVigenteEn", () => {
  it("EL BUG: enero deja de reescribirse con el arriendo de octubre", () => {
    const enero = mes(2026, 1);
    expect(estaVigenteEn(VIEJO, enero.desde, enero.hasta)).toBe(true);
    expect(estaVigenteEn(NUEVO, enero.desde, enero.hasta)).toBe(false);
  });

  it("en el mes del cambio cuenta la nueva y SOLO la nueva", () => {
    // `vigenteHasta` es exclusivo justamente por esto: con `gte` las dos filas
    // caerían en octubre y el arriendo se cobraría dos veces.
    const octubre = mes(2026, 10);
    expect(estaVigenteEn(VIEJO, octubre.desde, octubre.hasta)).toBe(false);
    expect(estaVigenteEn(NUEVO, octubre.desde, octubre.hasta)).toBe(true);
  });

  it("el mes anterior al cambio todavía cuenta la vieja", () => {
    const septiembre = mes(2026, 9);
    expect(estaVigenteEn(VIEJO, septiembre.desde, septiembre.hasta)).toBe(true);
    expect(estaVigenteEn(NUEVO, septiembre.desde, septiembre.hasta)).toBe(false);
  });

  it("nunca hay un mes con las dos filas ni un mes sin ninguna", () => {
    for (let m = 1; m <= 12; m++) {
      const { desde, hasta } = mes(2026, m);
      const cuentan = [VIEJO, NUEVO].filter((c) => estaVigenteEn(c, desde, hasta));
      expect(cuentan).toHaveLength(1);
    }
  });

  it("un costo dado de baja sigue contando en los meses en que sí se pagó", () => {
    const internet = { vigenteDesde: new Date(2026, 2, 1), vigenteHasta: new Date(2026, 5, 1) };
    const abril = mes(2026, 4);
    const junio = mes(2026, 6);
    expect(estaVigenteEn(internet, abril.desde, abril.hasta)).toBe(true);
    expect(estaVigenteEn(internet, junio.desde, junio.hasta)).toBe(false);
  });

  it("un costo que todavía no existía no aparece en meses anteriores", () => {
    const febrero = mes(2026, 2);
    expect(estaVigenteEn({ vigenteDesde: new Date(2026, 6, 1), vigenteHasta: null }, febrero.desde, febrero.hasta)).toBe(
      false
    );
  });

  it("una vigencia vacía (alta y baja el mismo mes) no cuenta en ningún mes", () => {
    const efimero = { vigenteDesde: new Date(2026, 3, 1), vigenteHasta: new Date(2026, 3, 1) };
    for (let m = 1; m <= 12; m++) {
      const { desde, hasta } = mes(2026, m);
      expect(estaVigenteEn(efimero, desde, hasta)).toBe(false);
    }
  });
});

describe("inicioDeMes", () => {
  it("ancla al día 1 sin importar el día ni la hora", () => {
    expect(inicioDeMes(new Date(2026, 9, 20, 18, 45))).toEqual(new Date(2026, 9, 1));
  });
});

describe("repartirFijos", () => {
  it("el retiro de socios no se mezcla con los gastos fijos", () => {
    // Repartir la ganancia no es un costo de operar: si se sumaran, el negocio
    // se vería menos rentable de lo que es.
    const r = repartirFijos([
      { monto: 1200000, esRetiro: false },
      { monto: 300000, esRetiro: false },
      { monto: 800000, esRetiro: true },
    ]);
    expect(r.gastosFijos).toBe(1500000);
    expect(r.retiroPresupuestado).toBe(800000);
  });

  it("sin costos ambos son cero", () => {
    expect(repartirFijos([])).toEqual({ gastosFijos: 0, retiroPresupuestado: 0 });
  });
});
