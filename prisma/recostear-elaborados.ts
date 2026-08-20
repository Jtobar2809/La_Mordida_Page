/**
 * Recalcula el costoUnitario de TODOS los insumos elaborados a partir de su
 * composición y su rendimiento — lo mismo que hace el botón «Usar como costo
 * del insumo», pero de una sola pasada.
 *
 *   npm run db:recostear
 *
 * Hace falta porque el costo de un elaborado es una foto, no una fórmula viva:
 * cuando una compra cambia el precio de la mayonesa, el aderezo se queda con el
 * costo que tenía y nadie avisa. Así apareció un aderezo costeado en $0,0063/ml
 * cuando su composición daba $6,33/ml, y toda hamburguesa que lo llevaba
 * mostraba un margen inflado.
 */
import { PrismaClient } from "@prisma/client";
import { redondearCosto, referenciaDesdeCosto, formatCosto } from "../src/lib/costos";

const prisma = new PrismaClient();

/** Mismo cálculo recursivo que src/actions/admin/composicion.ts */
async function calcularCostoInsumo(
  insumoId: string,
  cache: Map<string, number>,
  enProceso: Set<string>
): Promise<number> {
  if (cache.has(insumoId)) return cache.get(insumoId)!;
  if (enProceso.has(insumoId)) return 0;
  enProceso.add(insumoId);

  const insumo = await prisma.insumo.findUnique({
    where: { id: insumoId },
    select: { costoUnitario: true, esElaborado: true, rendimiento: true },
  });
  if (!insumo) {
    enProceso.delete(insumoId);
    return 0;
  }

  if (!insumo.esElaborado) {
    enProceso.delete(insumoId);
    cache.set(insumoId, insumo.costoUnitario);
    return insumo.costoUnitario;
  }

  const componentes = await prisma.insumoComponente.findMany({
    where: { insumoElaboradoId: insumoId },
    select: { cantidad: true, insumoBaseId: true },
  });

  if (componentes.length === 0) {
    enProceso.delete(insumoId);
    cache.set(insumoId, insumo.costoUnitario);
    return insumo.costoUnitario;
  }

  let total = 0;
  for (const c of componentes) {
    total += c.cantidad * (await calcularCostoInsumo(c.insumoBaseId, cache, enProceso));
  }

  const rinde = insumo.rendimiento > 0 ? insumo.rendimiento : 1;
  const porUnidad = redondearCosto(total / rinde);
  enProceso.delete(insumoId);
  cache.set(insumoId, porUnidad);
  return porUnidad;
}

async function main() {
  const elaborados = await prisma.insumo.findMany({
    where: { esElaborado: true },
    include: { _count: { select: { composicion: true } } },
    orderBy: { nombre: "asc" },
  });

  const cache = new Map<string, number>();

  for (const e of elaborados) {
    if (e._count.composicion === 0) {
      console.log(`— ${e.nombre}: sin composición todavía, se deja en ${formatCosto(e.costoUnitario)}.`);
      continue;
    }

    const nuevo = await calcularCostoInsumo(e.id, cache, new Set());

    if (nuevo === e.costoUnitario) {
      console.log(`= ${e.nombre}: ya estaba correcto en ${formatCosto(nuevo)}/${e.unidad.toLowerCase()}.`);
      continue;
    }

    await prisma.insumo.update({
      where: { id: e.id },
      data: referenciaDesdeCosto(nuevo, e.cantidadReferencia),
    });
    console.log(
      `✓ ${e.nombre}: ${formatCosto(e.costoUnitario)} → ${formatCosto(nuevo)} por ${e.unidad.toLowerCase()}` +
        ` (tanda de ${e.rendimiento} = ${formatCosto(nuevo * e.rendimiento)})`
    );
  }

  // Qué queda en $0 y por qué, para que no pase inadvertido.
  const sinCosto = await prisma.insumo.findMany({
    where: { costoUnitario: 0, activo: true },
    select: { nombre: true, esElaborado: true },
    orderBy: { nombre: "asc" },
  });
  if (sinCosto.length > 0) {
    console.log(`\nSiguen en $0 (${sinCosto.length}):`);
    for (const i of sinCosto) console.log(`   ${i.nombre}${i.esElaborado ? " (elaborado, falta su composición)" : ""}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
