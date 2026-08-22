import { describe, it, expect } from "vitest";
import { calcularCupoRetiros, type RetiroDelMes } from "./retiros";

const retiro = (monto: number, dia = 1): RetiroDelMes => ({
  id: `r${dia}-${monto}`,
  fecha: new Date(2026, 7, dia),
  monto,
  concepto: "Retiro de socios",
  metodo: "EFECTIVO",
  sesionCodigo: `CAJA-2608${String(dia).padStart(2, "0")}-01`,
});

const CUPO = 800000;

describe("calcularCupoRetiros", () => {
  it("un mes sin retiros deja el cupo completo", () => {
    const c = calcularCupoRetiros(CUPO, [], 2026, 8);
    expect(c.retirado).toBe(0);
    expect(c.saldo).toBe(CUPO);
    expect(c.exceso).toBe(0);
    expect(c.usadoPct).toBe(0);
  });

  it("los retiros del día se van descontando del cupo del mes", () => {
    const c = calcularCupoRetiros(CUPO, [retiro(50000, 1), retiro(30000, 2), retiro(20000, 3)], 2026, 8);
    expect(c.retirado).toBe(100000);
    expect(c.saldo).toBe(700000);
    expect(c.usadoPct).toBeCloseTo(12.5);
  });

  it("pasarse del cupo no rompe nada: deja saldo negativo y reporta el exceso", () => {
    // La decisión es avisar, no bloquear: es la plata de los socios. Pero el
    // exceso tiene que quedar visible, no escondido en un saldo topado en cero.
    const c = calcularCupoRetiros(CUPO, [retiro(900000)], 2026, 8);
    expect(c.saldo).toBe(-100000);
    expect(c.exceso).toBe(100000);
    expect(c.usadoPct).toBeCloseTo(112.5);
  });

  it("gastar el cupo exacto no cuenta como exceso", () => {
    const c = calcularCupoRetiros(CUPO, [retiro(800000)], 2026, 8);
    expect(c.saldo).toBe(0);
    expect(c.exceso).toBe(0);
    expect(c.usadoPct).toBe(100);
  });

  it("sin presupuesto configurado no inventa un porcentaje infinito", () => {
    // Dividir por cero daría Infinity y una barra de progreso rota.
    const c = calcularCupoRetiros(0, [retiro(50000)], 2026, 8);
    expect(c.hayPresupuesto).toBe(false);
    expect(c.usadoPct).toBe(0);
    expect(c.retirado).toBe(50000);
    expect(c.exceso).toBe(50000);
  });
});
