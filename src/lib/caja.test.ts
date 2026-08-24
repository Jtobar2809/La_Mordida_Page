import { describe, it, expect } from "vitest";
import { calcularResumenCaja, type MovimientoParaArqueo } from "./caja";

const venta = (monto: number, metodo: MovimientoParaArqueo["metodo"], orderId: string | null = null) =>
  ({ tipo: "VENTA", metodo, monto, orderId }) as MovimientoParaArqueo;
const ingreso = (monto: number, metodo: MovimientoParaArqueo["metodo"] = "EFECTIVO") =>
  ({ tipo: "INGRESO", metodo, monto, orderId: null }) as MovimientoParaArqueo;
const egreso = (monto: number, metodo: MovimientoParaArqueo["metodo"] = "EFECTIVO") =>
  ({ tipo: "EGRESO", metodo, monto, orderId: null }) as MovimientoParaArqueo;
const retiro = (monto: number, metodo: MovimientoParaArqueo["metodo"] = "EFECTIVO") =>
  ({ tipo: "RETIRO", metodo, monto, orderId: null }) as MovimientoParaArqueo;

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

  it("un retiro de socio vacía el cajón igual que un egreso", () => {
    const r = calcularResumenCaja(100000, [venta(50000, "EFECTIVO", "o1"), retiro(30000)]);
    expect(r.esperadoEfectivo).toBe(120000);
    expect(r.totalRetiros).toBe(30000);
  });

  it("el retiro NO se cuenta como gasto del turno", () => {
    // Es la razón de ser del tipo aparte: si el retiro engordara totalEgresos,
    // el turno se vería más caro de operar de lo que fue y la contabilidad
    // terminaría restando la plata de los socios dos veces —una como gasto y
    // otra debajo de la utilidad.
    const r = calcularResumenCaja(0, [egreso(20000), retiro(50000)]);
    expect(r.totalEgresos).toBe(20000);
    expect(r.totalRetiros).toBe(50000);
  });

  it("un retiro por Nequi no toca el efectivo esperado", () => {
    const r = calcularResumenCaja(50000, [retiro(40000, "NEQUI")]);
    expect(r.totalRetiros).toBe(40000);
    expect(r.esperadoEfectivo).toBe(50000);
  });

  it("un retiro no infla las ventas ni los ingresos del turno", () => {
    const r = calcularResumenCaja(80000, [retiro(25000)]);
    expect(r.totalVentas).toBe(0);
    expect(r.totalIngresos).toBe(0);
    expect(r.cantidadVentas).toBe(0);
    expect(r.esperadoEfectivo).toBe(55000);
  });
});

describe("calcularResumenCaja · ventas anuladas", () => {
  /** Anular deja el VENTA original y le suma un EGRESO que lo compensa. */
  const ventaAnulada = (monto: number, metodo: MovimientoParaArqueo["metodo"], orderId: string) =>
    [
      { tipo: "VENTA", metodo, monto, orderId, estadoOrden: "CANCELADO" },
      { tipo: "EGRESO", metodo, monto, orderId, estadoOrden: "CANCELADO" },
    ] as MovimientoParaArqueo[];

  it("EL BUG: la venta anulada se contaba como venta y su devolución como gasto", () => {
    const r = calcularResumenCaja(100000, [venta(28000, "EFECTIVO", "o1"), ...ventaAnulada(35000, "EFECTIVO", "o2")]);
    expect(r.totalVentas).toBe(28000); // antes: 63000
    expect(r.totalEgresos).toBe(0); // antes: 35000
    expect(r.totalAnulaciones).toBe(35000);
  });

  it("el efectivo sigue cuadrando: la plata entró y volvió a salir", () => {
    // Esto es lo que no se puede tocar. La anulación no cambia un peso del
    // arqueo, solo cómo se lee.
    const r = calcularResumenCaja(100000, [venta(28000, "EFECTIVO", "o1"), ...ventaAnulada(35000, "EFECTIVO", "o2")]);
    expect(r.esperadoEfectivo).toBe(128000);
  });

  it("una anulación por Nequi tampoco toca el cajón", () => {
    const r = calcularResumenCaja(50000, ventaAnulada(20000, "NEQUI", "o3"));
    expect(r.esperadoEfectivo).toBe(50000);
    expect(r.totalNequi).toBe(0);
    expect(r.totalAnulaciones).toBe(20000);
  });

  it("la venta anulada no cuenta como pedido del turno", () => {
    const r = calcularResumenCaja(0, [venta(10000, "EFECTIVO", "o1"), ...ventaAnulada(10000, "EFECTIVO", "o2")]);
    expect(r.cantidadVentas).toBe(1);
  });

  it("un egreso normal sigue siendo gasto del negocio", () => {
    // La anulación se reconoce por el pedido cancelado, no por ser un EGRESO:
    // pagar el pan del día tiene que seguir contando como egreso.
    const r = calcularResumenCaja(100000, [egreso(15000), ...ventaAnulada(20000, "EFECTIVO", "o4")]);
    expect(r.totalEgresos).toBe(15000);
    expect(r.totalAnulaciones).toBe(20000);
  });

  it("un movimiento sin pedido detrás se comporta como siempre", () => {
    const r = calcularResumenCaja(0, [venta(9000, "EFECTIVO", null), ingreso(1000), retiro(2000)]);
    expect(r.totalVentas).toBe(9000);
    expect(r.totalAnulaciones).toBe(0);
    expect(r.esperadoEfectivo).toBe(8000);
  });
});
