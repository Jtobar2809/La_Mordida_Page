import { describe, it, expect } from "vitest";
import { calcularSaldo, calcularEfectivoGuardado, type MovimientoParaSaldo } from "./saldos";
import { calcularResumenCaja, type MovimientoParaArqueo } from "./caja";

const mov = (
  tipo: MovimientoParaSaldo["tipo"],
  metodo: MovimientoParaSaldo["metodo"],
  monto: number,
  estadoOrden: string | null = null
) => ({ tipo, metodo, monto, estadoOrden }) as MovimientoParaSaldo;

describe("calcularSaldo", () => {
  it("sin movimientos, el saldo es exactamente el ancla", () => {
    const r = calcularSaldo({ metodo: "NEQUI", ancla: 250000, movimientos: [] });
    expect(r.saldo).toBe(250000);
    expect(r.entradas).toBe(0);
    expect(r.salidas).toBe(0);
  });

  it("ignora por completo los movimientos de otro medio", () => {
    // El punto de todo el cuadro: la plata del celular y la del cajón no se
    // mezclan. Un pago en efectivo no puede subir el saldo de Nequi.
    const r = calcularSaldo({
      metodo: "NEQUI",
      ancla: 0,
      movimientos: [mov("VENTA", "EFECTIVO", 30000), mov("VENTA", "NEQUI", 12000)],
    });
    expect(r.entradas).toBe(12000);
    expect(r.saldo).toBe(12000);
  });

  it("las ventas y los ingresos suman; los egresos y los retiros restan", () => {
    const r = calcularSaldo({
      metodo: "NEQUI",
      ancla: 100000,
      movimientos: [
        mov("VENTA", "NEQUI", 40000),
        mov("INGRESO", "NEQUI", 10000),
        mov("EGRESO", "NEQUI", 15000),
        mov("RETIRO", "NEQUI", 20000),
      ],
    });
    expect(r.entradas).toBe(50000);
    expect(r.salidas).toBe(35000);
    expect(r.retiros).toBe(20000);
    expect(r.saldo).toBe(115000);
  });

  it("una venta anulada y su devolución se cancelan y dejan el saldo intacto", () => {
    // Anular no borra el cobro: deja el VENTA y le suma el EGRESO que lo
    // compensa. Filtrar la venta anulada y dejar la devolución —que es lo que
    // hace el estado de resultados, y con razón— restaría la plata dos veces.
    const r = calcularSaldo({
      metodo: "NEQUI",
      ancla: 80000,
      movimientos: [mov("VENTA", "NEQUI", 25000, "CANCELADO"), mov("EGRESO", "NEQUI", 25000, "CANCELADO")],
    });
    expect(r.saldo).toBe(80000);
    expect(r.anulaciones).toBe(25000);
    // La devolución se cuenta como salida, pero NO como gasto del negocio.
    expect(r.retiros).toBe(0);
  });

  it("un retiro por Nequi no cuenta como devolución aunque cuelgue de nada", () => {
    const r = calcularSaldo({ metodo: "NEQUI", ancla: 50000, movimientos: [mov("RETIRO", "NEQUI", 50000)] });
    expect(r.retiros).toBe(50000);
    expect(r.anulaciones).toBe(0);
    expect(r.saldo).toBe(0);
  });

  it("los gastos que no pasaron por la caja también vacían el saldo", () => {
    // El caso que motivó todo esto: pagar el internet por Nequi desde la
    // pantalla de gastos no crea egreso de caja. La plata se fue igual.
    const r = calcularSaldo({
      metodo: "NEQUI",
      ancla: 200000,
      movimientos: [mov("VENTA", "NEQUI", 30000)],
      salidasFueraDeCaja: 90000,
    });
    expect(r.salidasFueraDeCaja).toBe(90000);
    expect(r.saldo).toBe(140000);
  });

  it("el saldo puede quedar negativo y no se maquilla", () => {
    // Un negativo significa que se registró más salida de la que existía. Es un
    // error de registro, y esconderlo con Math.max lo volvería invisible.
    const r = calcularSaldo({ metodo: "NEQUI", ancla: 10000, movimientos: [mov("EGRESO", "NEQUI", 30000)] });
    expect(r.saldo).toBe(-20000);
  });
});

describe("el cajón dice lo mismo en los dos módulos", () => {
  it("el saldo en efectivo coincide con el esperado del arqueo", () => {
    // Son dos cálculos distintos sobre los mismos movimientos, y tienen que dar
    // igual: si el cuadro dijera una cifra y el cierre del turno otra, el dueño
    // tendría dos respuestas para "cuánto hay en el cajón" y ninguna forma de
    // saber cuál creer. Este test es lo que evita que se separen en silencio.
    const movimientos: MovimientoParaSaldo[] = [
      mov("VENTA", "EFECTIVO", 45000, "ENTREGADO"),
      mov("VENTA", "NEQUI", 30000, "ENTREGADO"),
      mov("VENTA", "EFECTIVO", 12000, "CANCELADO"),
      mov("EGRESO", "EFECTIVO", 12000, "CANCELADO"),
      mov("INGRESO", "EFECTIVO", 20000),
      mov("EGRESO", "EFECTIVO", 8000),
      mov("RETIRO", "EFECTIVO", 50000),
    ];

    const porSaldos = calcularSaldo({ metodo: "EFECTIVO", ancla: 100000, movimientos });
    const porArqueo = calcularResumenCaja(
      100000,
      movimientos.map((m) => ({ ...m, orderId: null }) as MovimientoParaArqueo)
    );

    expect(porSaldos.saldo).toBe(porArqueo.esperadoEfectivo);
    expect(porSaldos.saldo).toBe(107000);
  });
});

describe("calcularEfectivoGuardado", () => {
  const sesion = (montoInicial: number, efectivoContado: number | null) => ({ montoInicial, efectivoContado });

  it("sin turnos no hay nada guardado", () => {
    expect(calcularEfectivoGuardado([])).toEqual({ monto: 0, cierres: 0 });
  });

  it("el último turno no aporta: su plata sigue en el cajón", () => {
    // Si contara, el cuadro sumaría dos veces el efectivo del turno vigente.
    const r = calcularEfectivoGuardado([sesion(100000, 400000)]);
    expect(r).toEqual({ monto: 0, cierres: 0 });
  });

  it("lo que sobró de un cierre y no volvió como base del siguiente", () => {
    // Cerró con $400.000 contados, el siguiente abrió con $100.000 de base:
    // $300.000 se guardaron en alguna parte.
    const r = calcularEfectivoGuardado([sesion(100000, 400000), sesion(100000, null)]);
    expect(r).toEqual({ monto: 300000, cierres: 1 });
  });

  it("acumula cierre tras cierre", () => {
    const r = calcularEfectivoGuardado([
      sesion(100000, 400000),
      sesion(100000, 250000),
      sesion(50000, null),
    ]);
    expect(r.monto).toBe(300000 + 200000);
    expect(r.cierres).toBe(2);
  });

  it("si el turno siguiente abrió con más base de la que se contó, el guardado baja", () => {
    // Alguien metió plata de su bolsillo para dar vueltas. La resta lo dice
    // sola y queda en negativo, que es exactamente lo que pasó.
    const r = calcularEfectivoGuardado([sesion(50000, 80000), sesion(200000, null)]);
    expect(r.monto).toBe(-120000);
  });

  it("un turno sin contar todavía no se puede deducir, y se salta", () => {
    // Solo puede pasar con datos viejos o corruptos: un turno cerrado siempre
    // tiene efectivoContado. Saltarlo es mejor que tratarlo como cero, que
    // inventaría un faltante igual a la base del siguiente.
    const r = calcularEfectivoGuardado([sesion(100000, null), sesion(100000, 300000), sesion(100000, null)]);
    expect(r).toEqual({ monto: 200000, cierres: 1 });
  });
});
