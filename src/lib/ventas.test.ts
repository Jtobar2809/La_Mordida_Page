import { describe, it, expect } from "vitest";
import { desglosarVenta } from "./ventas";

/** Un domicilio de $28.000 de comida, $5.000 de envío, sin impuesto. */
const CON_DOMICILIO = { _sum: { subtotal: 28000, discount: 0, deliveryFee: 5000, tax: 0 } };

describe("desglosarVenta", () => {
  it("EL BUG: el domicilio se contaba como venta del negocio", () => {
    // `total` eran $33.000 y eso era lo que entraba al estado de resultados.
    // Son $5.000 de "ingreso" sin un gramo de costo de insumo detrás, así que
    // inflaban el margen bruto — y con él el punto de equilibrio salía bajo.
    const d = desglosarVenta(CON_DOMICILIO);
    expect(d.ventas).toBe(28000);
    expect(d.domicilios).toBe(5000);
  });

  it("el impuesto recaudado no es plata del negocio", () => {
    // Hoy taxRate está en 0 y el error duerme. El día que se active el 8% de
    // impoconsumo, ese recaudo es un pasivo con la DIAN, no utilidad.
    const d = desglosarVenta({ _sum: { subtotal: 100000, discount: 0, deliveryFee: 0, tax: 8000 } });
    expect(d.ventas).toBe(100000);
    expect(d.impuestos).toBe(8000);
  });

  it("los descuentos y promociones sí bajan la venta", () => {
    const d = desglosarVenta({ _sum: { subtotal: 60000, discount: 12000, deliveryFee: 0, tax: 0 } });
    expect(d.ventas).toBe(48000);
  });

  it("un mes sin pedidos da ceros, no NaN", () => {
    expect(desglosarVenta({ _sum: null })).toEqual({ ventas: 0, domicilios: 0, impuestos: 0 });
    expect(desglosarVenta({})).toEqual({ ventas: 0, domicilios: 0, impuestos: 0 });
  });

  it("aguanta que Prisma devuelva null en una columna suelta", () => {
    const d = desglosarVenta({ _sum: { subtotal: 20000, discount: null, deliveryFee: null, tax: null } });
    expect(d.ventas).toBe(20000);
    expect(d.domicilios).toBe(0);
  });
});
