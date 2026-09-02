import type { CajaSesion, MetodoPago, MovimientoCaja, Product, ProductExtra } from "@prisma/client";
import type { ResumenCaja } from "@/lib/caja";

/**
 * Nombres de los métodos de pago para la interfaz.
 *
 * Vive aquí y no en `@/lib/caja` porque lo usan componentes cliente, y ese
 * módulo importa Prisma: bastaría un `import` desde el navegador para arrastrar
 * todo el cliente de base de datos al bundle. Este archivo solo tiene tipos
 * (que se borran al compilar) y funciones puras, así que es seguro para ambos
 * lados.
 */
export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  NEQUI: "Nequi",
  OTRO: "Otro",
};

export type ProductoPOS = Pick<Product, "id" | "name" | "price" | "image" | "available" | "categoryId"> & {
  extras: Pick<ProductExtra, "id" | "name" | "price">[];
};

export type CategoriaPOS = {
  id: string;
  name: string;
  productos: ProductoPOS[];
};

/**
 * Un cliente registrado, para poder ponerle nombre a una venta de mostrador.
 *
 * Es opcional a propósito: la mayoría de las ventas del mostrador son de gente
 * que no está registrada y no tiene por qué estarlo. Cuando no se elige a
 * nadie, la venta queda a nombre del cliente genérico de mostrador, igual que
 * antes.
 */
export type ClientePOS = {
  id: string;
  name: string | null;
  phone: string | null;
};

export type SesionCajaActiva = CajaSesion & {
  abiertaPor: { id: string; name: string | null; email: string | null };
  movimientos: MovimientoCaja[];
  resumen: ResumenCaja;
};

/** Una línea del carrito del POS, antes de convertirse en OrderItem. */
export type LineaCarrito = {
  /** Clave local del carrito: el mismo producto puede estar dos veces con extras distintos. */
  key: string;
  productId: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  extrasDisponibles: Pick<ProductExtra, "id" | "name" | "price">[];
  extrasElegidos: string[];
  notas: string;
};

export function totalLinea(linea: LineaCarrito) {
  const extras = linea.extrasDisponibles
    .filter((e) => linea.extrasElegidos.includes(e.id))
    .reduce((suma, e) => suma + e.price, 0);
  return (linea.precioUnitario + extras) * linea.cantidad;
}
