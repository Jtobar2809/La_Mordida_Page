import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InventarioTabs } from "@/components/admin/inventario-tabs";
import { ESTADOS_VENTA_CONFIRMADA, obtenerPerdidas } from "@/lib/inventario";
import { formatCosto } from "@/lib/costos";

export const dynamic = "force-dynamic";

const RANGOS = [
  { dias: 7, label: "7 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "90 días" },
];

// Prisma necesita explícitamente OrderStatus[].
// ESTADOS_VENTA_CONFIRMADA puede estar inferido como string[].
const estadosVentaConfirmada = ESTADOS_VENTA_CONFIRMADA as OrderStatus[];

export default async function AdminResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>;
}) {
  const { dias: diasParam } = await searchParams;

  const diasNumero = Number(diasParam ?? 30);
  const dias = Number.isFinite(diasNumero) && diasNumero > 0 ? diasNumero : 30;

  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const [ventas, movimientosVenta, compras, insumos, productos, perdidas] =
    await Promise.all([
      prisma.order.aggregate({
        where: {
          status: {
            in: estadosVentaConfirmada,
          },
          createdAt: {
            gte: desde,
          },
        },
        _sum: {
          total: true,
        },
        _count: {
          _all: true,
        },
      }),

      // SALIDA y ENTRADA, no solo SALIDA: cancelar un pedido no borra la salida
      // de inventario, crea una entrada que la compensa. Contando solo las
      // salidas, cada cancelación sumaba al costo de venta como si la comida se
      // hubiera consumido — un pedido cancelado de $28.000 inflaba el costo en
      // los $16.208 de su receta y hundía el margen bruto sin explicación.
      prisma.movimientoInsumo.findMany({
        where: {
          tipo: {
            in: ["SALIDA", "ENTRADA"],
          },
          orderId: {
            not: null,
          },
          createdAt: {
            gte: desde,
          },
        },
        include: {
          insumo: {
            select: {
              costoUnitario: true,
            },
          },
        },
      }),

      prisma.compra.aggregate({
        where: {
          fecha: {
            gte: desde,
          },
        },
        _sum: {
          total: true,
        },
        _count: {
          _all: true,
        },
      }),

      prisma.insumo.findMany({
        where: {
          activo: true,
        },
      }),

      prisma.product.findMany({
        where: {
          available: true,
        },
        include: {
          recetaItems: {
            include: {
              insumo: true,
            },
          },
        },
      }),

      obtenerPerdidas(desde),
    ]);

  // Prisma puede devolver _sum como undefined cuando no existen registros.
  const ingresos = ventas._sum?.total ?? 0;
  const cantidadPedidos = ventas._count._all;

  const cogs = movimientosVenta.reduce((sum, movimiento) => {
    const costo =
      movimiento.cantidad *
      (movimiento.costoUnitario ?? movimiento.insumo.costoUnitario);
    return movimiento.tipo === "ENTRADA" ? sum - costo : sum + costo;
  }, 0);

  const margenBruto = ingresos - cogs;

  const margenBrutoPct =
    ingresos > 0
      ? Math.round((margenBruto / ingresos) * 100)
      : 0;

  const valorInventario = insumos.reduce(
    (sum, insumo) =>
      sum + insumo.stockActual * insumo.costoUnitario,
    0
  );

  const stockBajo = insumos.filter(
    (insumo) => insumo.stockActual <= insumo.stockMinimo
  ).length;

  const sinCosto = insumos.filter(
    (insumo) => insumo.costoUnitario === 0
  ).length;

  const productosConReceta = productos
    .filter((producto) => producto.recetaItems.length > 0)
    .map((producto) => {
      const costo = producto.recetaItems.reduce(
        (sum, recetaItem) =>
          sum +
          recetaItem.cantidad *
            recetaItem.insumo.costoUnitario,
        0
      );

      const margen = producto.price - costo;

      const pct =
        producto.price > 0
          ? Math.round((margen / producto.price) * 100)
          : 0;

      return {
        nombre: producto.name,
        margenPct: pct,
      };
    });

  const mejorMargen = [...productosConReceta]
    .sort((a, b) => b.margenPct - a.margenPct)
    .slice(0, 3);

  const peorMargen = [...productosConReceta]
    .sort((a, b) => a.margenPct - b.margenPct)
    .slice(0, 3);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
          INVENTARIO · RESUMEN
        </h1>

        <InventarioTabs />
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {RANGOS.map((rango) => (
          <Link
            key={rango.dias}
            href={`/admin/inventario/resumen?dias=${rango.dias}`}
            className={
              dias === rango.dias
                ? "rounded-full bg-charcoal-800 px-3 py-1.5 font-medium text-white dark:bg-cream dark:text-charcoal-900"
                : "rounded-full px-3 py-1.5 font-medium text-charcoal-500 hover:bg-charcoal-100 dark:text-charcoal-300 dark:hover:bg-charcoal-700/50"
            }
          >
            {rango.label}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
          <p className="text-xs uppercase tracking-wide text-charcoal-400">
            Ingresos ({cantidadPedidos} pedidos)
          </p>

          <p className="mt-1 font-display text-2xl text-charcoal-900 dark:text-cream">
            {formatCosto(ingresos)}
          </p>
        </div>

        <div className="rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
          <p className="text-xs uppercase tracking-wide text-charcoal-400">
            Costo de venta (insumos)
          </p>

          <p className="mt-1 font-display text-2xl text-charcoal-900 dark:text-cream">
            {formatCosto(cogs)}
          </p>
        </div>

        <div className="rounded-2xl border border-olive-200 bg-olive-50 p-4 dark:border-olive-800 dark:bg-olive-900/20">
          <p className="text-xs uppercase tracking-wide text-olive-700 dark:text-olive-300">
            Margen bruto
          </p>

          <p className="mt-1 font-display text-2xl text-olive-700 dark:text-olive-300">
            {formatCosto(margenBruto)}{" "}
            <span className="text-base">
              ({margenBrutoPct}%)
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-xs uppercase tracking-wide text-red-700 dark:text-red-300">
            Pérdidas (mermas/ajustes)
          </p>

          <p className="mt-1 font-display text-2xl text-red-700 dark:text-red-300">
            {formatCosto(perdidas.total)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
          <p className="text-xs uppercase tracking-wide text-charcoal-400">
            Valor de inventario actual
          </p>

          <p className="mt-1 font-display text-xl text-charcoal-900 dark:text-cream">
            {formatCosto(valorInventario)}
          </p>
        </div>

        <div className="rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
          <p className="text-xs uppercase tracking-wide text-charcoal-400">
            Comprado en el período
          </p>

          <p className="mt-1 font-display text-xl text-charcoal-900 dark:text-cream">
            {formatCosto(compras._sum?.total ?? 0)}{" "}
            <span className="text-sm text-charcoal-400">
              ({compras._count._all})
            </span>
          </p>
        </div>

        <Link
          href="/admin/inventario"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
        >
          <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Alertas activas
          </p>

          <p className="mt-1 font-display text-xl text-amber-700 dark:text-amber-300">
            {stockBajo} stock bajo · {sinCosto} sin costo
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-charcoal-100 p-4 dark:border-charcoal-700">
          <p className="mb-3 text-sm font-medium text-charcoal-600 dark:text-charcoal-300">
            Mejor margen
          </p>

          {mejorMargen.length === 0 ? (
            <p className="text-sm text-charcoal-400">
              Sin productos con receta y precio configurados todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {mejorMargen.map((producto) => (
                <div
                  key={producto.nombre}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-charcoal-700 dark:text-cream">
                    {producto.nombre}
                  </span>

                  <span className="font-mono font-semibold text-olive-600 dark:text-olive-400">
                    {producto.margenPct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-charcoal-100 p-4 dark:border-charcoal-700">
          <p className="mb-3 text-sm font-medium text-charcoal-600 dark:text-charcoal-300">
            Margen más bajo — revisar precio o receta
          </p>

          {peorMargen.length === 0 ? (
            <p className="text-sm text-charcoal-400">
              Sin productos con receta y precio configurados todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {peorMargen.map((producto) => (
                <div
                  key={producto.nombre}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-charcoal-700 dark:text-cream">
                    {producto.nombre}
                  </span>

                  <span
                    className={`font-mono font-semibold ${
                      producto.margenPct < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-charcoal-500"
                    }`}
                  >
                    {producto.margenPct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

