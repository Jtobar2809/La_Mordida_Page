import { describe, it, expect } from "vitest";
import { calcularResumenCaja, type MovimientoParaArqueo } from "./caja";

const venta = (monto: number, metodo: MovimientoParaArqueo["metodo"], orderId: string | null = null) =>
  ({ tipo: "VENTA", metodo, monto, orderId }) as MovimientoParaArqueo;
const ingreso = (monto: number, metodo: MovimientoParaArqueo["metodo"] = "EFECTIVO") =>
  ({ tipo: "INGRESO", metodo, monto, orderId: null }) as MovimientoParaArqueo;
const egreso = (monto: number, metodo: MovimientoParaArqueo["metodo"] = "EFECTIVO") =>
  ({ tipo: "EGRESO", metodo, monto, orderId: null }) as MovimientoParaArqueo;

describe("calcularResumenCaja", () => {
  it("una caja sin movimientos espera exactamente su base", () => {
    const r = calcularResumenCaja(100000, []);
    expect(r.esperadoEfectivo).toBe(100000);
    expect(r.totalVentas).toBe(0);
  });

  it("el Nequi NO cuenta como efectivo en el cajón", () => {
    // Si contara, todo turno cerraría con un faltante fantasma exactamente
    // igual al total de Nequi: la plata está en el celular, no en el cajón.
    const r = calcularResumenCaja(50000, [venta(28000, "NEQUI", "o1")]);
    expect(r.totalVentas).toBe(28000);
    expect(r.totalNequi).toBe(28000);
    expect(r.totalEfectivo).toBe(0);
    expect(r.esperadoEfectivo).toBe(50000);
  });

  it("los egresos en efectivo salen del cajón", () => {
    const r = calcularResumenCaja(50000, [venta(30000, "EFECTIVO", "o1"), egreso(10000)]);
    expect(r.esperadoEfectivo).toBe(70000);
    expect(r.totalEgresos).toBe(10000);
  });

  it("un egreso por Nequi no toca el efectivo esperado", () => {
    const r = calcularResumenCaja(50000, [egreso(10000, "NEQUI")]);
    expect(r.totalEgresos).toBe(10000);
    expect(r.esperadoEfectivo).toBe(50000);
  });

  it("un pago mixto es una sola venta, no dos", () => {
    // Una venta pagada mitad efectivo mitad Nequi son dos filas del mismo
    // pedido: contarla como dos inflaría el conteo de ventas del turno.
    const r = calcularResumenCaja(0, [venta(15000, "EFECTIVO", "o1"), venta(15000, "NEQUI", "o1")]);
    expect(r.cantidadVentas).toBe(1);
    expect(r.totalVentas).toBe(30000);
  });

  it("reproduce el turno real del 20 de agosto", () => {
    // Cobraron $28.000 en efectivo, era Nequi, anularon con un egreso y
    // recobraron. Base $45.000, cerró con $97.000 contados y diferencia $0.
    const r = calcularResumenCaja(45000, [
      venta(52000, "EFECTIVO", "entregado-1"),
      venta(28000, "EFECTIVO", "anulado"),
      egreso(28000),
      venta(28000, "NEQUI", "entregado-2"),
    ]);
    expect(r.esperadoEfectivo).toBe(97000);
    expect(r.totalEfectivo).toBe(80000);
    expect(r.totalNequi).toBe(28000);
  });

  it("los ingresos por fuera de una venta suman al cajón", () => {
    const r = calcularResumenCaja(20000, [ingreso(15000)]);
    expect(r.totalIngresos).toBe(15000);
    expect(r.esperadoEfectivo).toBe(35000);
    expect(r.totalVentas).toBe(0);
  });
});
