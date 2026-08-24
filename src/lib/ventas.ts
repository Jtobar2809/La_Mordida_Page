/**
 * Qué parte de un pedido es ingreso del negocio.
 *
 * `Order.total` es lo que el cliente PAGA: `subtotal − descuento + domicilio +
 * impuesto`. No es lo que el restaurante vendió, y usarlo como ingreso metía
 * dos errores distintos en el mismo número:
 *
 *  - **El domicilio** entra y vuelve a salir hacia el domiciliario. Contarlo
 *    como venta propia infla el margen bruto, porque son $5.000 de "ingreso"
 *    sin un gramo de costo de insumo detrás.
 *  - **El impuesto** no es plata del negocio, es plata de la DIAN que uno solo
 *    está guardando. Hoy `taxRate` está en 0 y el error duerme; el día que se
 *    active, el impoconsumo recaudado empezaría a contarse como utilidad.
 *
 * La venta real es `subtotal − descuento`. Los otros dos se siguen midiendo,
 * pero aparte y con su nombre.
 */

/** Lo que hay que pedirle a `order.aggregate` para poder separar las tres cosas. */
export const SUMA_VENTA = {
  subtotal: true,
  discount: true,
  deliveryFee: true,
  tax: true,
} as const;

export type AgregadoVenta = {
  _sum?: {
    subtotal?: number | null;
    discount?: number | null;
    deliveryFee?: number | null;
    tax?: number | null;
  } | null;
};

export type DesgloseVenta = {
  /** Comida vendida, neta de descuentos y promociones. Esto es el ingreso. */
  ventas: number;
  /** Cobrado por llevarlo hasta la puerta. Ni es venta ni tiene costo de insumo. */
  domicilios: number;
  /** Recaudado para la DIAN. Es un pasivo, no un ingreso. */
  impuestos: number;
};

export function desglosarVenta(agg: AgregadoVenta): DesgloseVenta {
  const s = agg._sum;
  return {
    ventas: (s?.subtotal ?? 0) - (s?.discount ?? 0),
    domicilios: s?.deliveryFee ?? 0,
    impuestos: s?.tax ?? 0,
  };
}
