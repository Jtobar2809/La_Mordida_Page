import { prisma } from "@/lib/prisma";
import { PromocionesManager } from "@/components/admin/promociones-manager";
import { costoDeProducto } from "@/lib/costos";
import type { ProductoCosteado } from "@/lib/promociones";

export const dynamic = "force-dynamic";

export default async function AdminPromocionesPage() {
  const [productos, categorias] = await Promise.all([
    prisma.product.findMany({
      // Los combos que ya existen quedan fuera: un combo no puede contener otro.
      where: { available: true, esCombo: false },
      include: {
        category: { select: { name: true } },
        recetaItems: { include: { insumo: { select: { costoUnitario: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Sin receta no hay costo, y sin costo el producto aparecería con margen del
  // 100%: encabezaría el ranking y el generador recomendaría con total
  // confianza justo las peores promociones. Se separan y se dicen por nombre.
  const costeados: ProductoCosteado[] = [];
  const sinCosto: string[] = [];

  for (const p of productos) {
    const costo = costoDeProducto(p);
    if (p.recetaItems.length === 0 || costo <= 0) {
      sinCosto.push(p.name);
      continue;
    }
    costeados.push({ id: p.id, nombre: p.name, precio: p.price, costo, categoria: p.category.name });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">PROMOCIONES</h1>
        <p className="max-w-3xl text-sm text-charcoal-400">
          Todas las combinaciones que tiene sentido armar con tu carta, evaluadas contra tu margen real. La pregunta que
          responde no es cuánto descuento dar, sino si ese descuento te deja mejor o peor de como estabas.
        </p>
      </div>

      <PromocionesManager productos={costeados} sinCosto={sinCosto} categorias={categorias} />
    </div>
  );
}
