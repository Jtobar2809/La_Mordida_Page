/**
 * Carga única del inventario físico de La Mordida (ERP_La_Mordida_v3.xlsx).
 *
 * Por qué los datos están escritos aquí y no se lee el .xlsx en tiempo de
 * ejecución: es una carga que se hace una vez, y un .xlsx es un ZIP de XML cuyo
 * parseo agregaría una dependencia y una capa de fallos silenciosos para leer
 * 57 filas. Escritas aquí quedan a la vista, revisables en el code review y
 * versionadas junto al resto del proyecto.
 *
 * El stock NO se escribe directo sobre el insumo: se calcula la diferencia
 * contra lo que hay y se registra un MovimientoInsumo de tipo AJUSTE. Así la
 * carga inicial queda explicada en el libro mayor igual que cualquier otro
 * movimiento — si dentro de un mes alguien pregunta de dónde salieron 2.730 g
 * de carne, la respuesta está en el historial y no en la memoria de nadie.
 *
 * Uso:
 *   npm run db:import:inventario           → simulación, no escribe nada
 *   npm run db:import:inventario -- --aplicar → escribe en la base de datos
 */
import { PrismaClient, UnidadInsumo } from "@prisma/client";

const prisma = new PrismaClient();

const MOTIVO = "Carga inicial — inventario físico (ERP_La_Mordida_v3.xlsx)";

type FilaInventario = {
  /** Nombre tal cual aparece en el Excel, para poder rastrear el origen. */
  excel: string;
  /** Nombre final en el sistema (ortografía corregida). */
  nombre: string;
  /**
   * Insumo YA EXISTENTE al que corresponde esta fila. Es la parte crítica de la
   * carga: las recetas de los 11 productos apuntan a estos insumos por ID, así
   * que si "Carne" entrara como insumo nuevo, "Carne artesanal" seguiría en 0 y
   * cada venta la mandaría a negativo mientras el stock real no se movería.
   */
  fusionarCon?: string;
  stock: number;
  unidad: UnidadInsumo;
  stockMinimo: number;
  /** Anomalía del Excel que conviene revisar a ojo después de cargar. */
  nota?: string;
};

const INVENTARIO: FilaInventario[] = [
  // ── Proteínas y lácteos ────────────────────────────────────────────────
  { excel: "Carne", nombre: "Carne artesanal", fusionarCon: "Carne artesanal", stock: 2730, unidad: "GRAMOS", stockMinimo: 1300 },
  { excel: "Salchichas", nombre: "Salchicha americana", fusionarCon: "Salchicha americana", stock: 13, unidad: "UNIDAD", stockMinimo: 5, nota: "estaba en GRAMOS en la base; el Excel la cuenta por unidades" },
  { excel: "Chorizos", nombre: "Chorizo", fusionarCon: "Chorizo", stock: 7, unidad: "UNIDAD", stockMinimo: 3, nota: "estaba en GRAMOS en la base; el Excel lo cuenta por unidades" },
  { excel: "Queso Blanco", nombre: "Queso doble crema", fusionarCon: "Queso doble crema", stock: 1787, unidad: "GRAMOS", stockMinimo: 500 },
  { excel: "Queso Amarillo", nombre: "Queso fundido", fusionarCon: "Queso fundido", stock: 477, unidad: "UNIDAD", stockMinimo: 100, nota: "el Excel dice 'unidades' (¿lonchas?); si en realidad son gramos, corrígelo en el panel" },
  { excel: "Tocineta", nombre: "Tocineta", fusionarCon: "Tocineta", stock: 661, unidad: "GRAMOS", stockMinimo: 139 },
  { excel: "Jamon", nombre: "Jamón", fusionarCon: "Jamón", stock: 596, unidad: "GRAMOS", stockMinimo: 100 },
  { excel: "Huevo Cordorniz", nombre: "Huevo de codorniz", fusionarCon: "Huevo de codorniz", stock: 16, unidad: "UNIDAD", stockMinimo: 10 },
  { excel: "Huevos", nombre: "Huevo", stock: 3, unidad: "UNIDAD", stockMinimo: 3 },
  { excel: "Matequilla", nombre: "Mantequilla", stock: 375, unidad: "GRAMOS", stockMinimo: 125 },

  // ── Panadería ──────────────────────────────────────────────────────────
  { excel: "Pan Hamburguesa", nombre: "Pan brioche", fusionarCon: "Pan brioche", stock: 18, unidad: "UNIDAD", stockMinimo: 10 },
  { excel: "Pan Perro", nombre: "Pan de perro", stock: 14, unidad: "UNIDAD", stockMinimo: 4 },
  { excel: "Harina de trigo", nombre: "Harina de trigo", stock: 180, unidad: "GRAMOS", stockMinimo: 100 },
  { excel: "Miga de pan", nombre: "Miga de pan", stock: 550, unidad: "GRAMOS", stockMinimo: 100, nota: "el Excel escribía la unidad como 'grmos'" },

  // ── Vegetales y frutas ─────────────────────────────────────────────────
  { excel: "Tomate", nombre: "Tomate", fusionarCon: "Tomate", stock: 1000, unidad: "GRAMOS", stockMinimo: 250 },
  { excel: "Cebolla", nombre: "Cebolla", stock: 500, unidad: "GRAMOS", stockMinimo: 1000, nota: "por debajo del mínimo: el Excel ya la marcaba como COMPRAR" },
  { excel: "Lechuga", nombre: "Lechuga", fusionarCon: "Lechuga", stock: 400, unidad: "GRAMOS", stockMinimo: 250 },
  { excel: "Piña Tajada", nombre: "Piña asada", fusionarCon: "Piña asada", stock: 7, unidad: "UNIDAD", stockMinimo: 5, nota: "estaba en GRAMOS en la base; el Excel la cuenta por unidades" },
  { excel: "Piña Calada", nombre: "Piña calada", fusionarCon: "Piña calada", stock: 750, unidad: "GRAMOS", stockMinimo: 100 },
  { excel: "Pepinillos", nombre: "Pepinillos", stock: 250, unidad: "GRAMOS", stockMinimo: 125 },
  { excel: "Ajo", nombre: "Ajo", stock: 22, unidad: "GRAMOS", stockMinimo: 20 },
  { excel: "Ripio", nombre: "Ripio de papa", fusionarCon: "Ripio de papa", stock: 670, unidad: "GRAMOS", stockMinimo: 125 },

  // ── Salsas y condimentos ───────────────────────────────────────────────
  { excel: "Salsa de tomate", nombre: "Salsa de tomate", stock: 4180, unidad: "GRAMOS", stockMinimo: 500 },
  { excel: "Moztasa", nombre: "Mostaza", stock: 1108, unidad: "GRAMOS", stockMinimo: 500, nota: "en el Excel aparecía dos veces (1.108 y −54.188); se tomó 1.108 y se descartó el negativo por ser un error de fórmula" },
  { excel: "Mayonesa", nombre: "Mayonesa", stock: 2545, unidad: "GRAMOS", stockMinimo: 500 },
  { excel: "Salsa de piña", nombre: "Salsa de piña", stock: 1000, unidad: "GRAMOS", stockMinimo: 100 },
  { excel: "S bbq", nombre: "Salsa BBQ", stock: 329, unidad: "GRAMOS", stockMinimo: 120 },
  { excel: "S humo", nombre: "Salsa de humo", stock: 719, unidad: "GRAMOS", stockMinimo: 120 },
  { excel: "S negra", nombre: "Salsa negra", stock: 137, unidad: "GRAMOS", stockMinimo: 120 },
  { excel: "S carnes", nombre: "Salsa para carnes", stock: 356, unidad: "GRAMOS", stockMinimo: 120 },
  { excel: "S de ajo", nombre: "Salsa de ajo", stock: 500, unidad: "GRAMOS", stockMinimo: 125 },
  { excel: "Vinagre", nombre: "Vinagre", stock: 137, unidad: "GRAMOS", stockMinimo: 120 },
  { excel: "Vinagre manzanaa", nombre: "Vinagre de manzana", stock: 485, unidad: "GRAMOS", stockMinimo: 120 },
  { excel: "Aceite", nombre: "Aceite", stock: 750, unidad: "GRAMOS", stockMinimo: 500 },
  { excel: "Miel", nombre: "Miel", stock: 300, unidad: "GRAMOS", stockMinimo: 100 },
  { excel: "Sal", nombre: "Sal", stock: 1100, unidad: "GRAMOS", stockMinimo: 125 },
  { excel: "Azucar", nombre: "Azúcar", stock: 1500, unidad: "GRAMOS", stockMinimo: 125 },
  { excel: "Tomillo", nombre: "Tomillo", stock: 1, unidad: "UNIDAD", stockMinimo: 0 },
  { excel: "Comino", nombre: "Comino", stock: 1, unidad: "UNIDAD", stockMinimo: 0 },
  { excel: "Paprika", nombre: "Paprika", stock: 1, unidad: "UNIDAD", stockMinimo: 0 },
  { excel: "Cebolla p", nombre: "Cebolla en polvo", stock: 1, unidad: "UNIDAD", stockMinimo: 0 },
  { excel: "Ajo p", nombre: "Ajo en polvo", stock: 1, unidad: "UNIDAD", stockMinimo: 0 },

  // ── Bebidas ────────────────────────────────────────────────────────────
  { excel: "Jugo hit", nombre: "Jugo Hit", stock: 18, unidad: "UNIDAD", stockMinimo: 6 },
  { excel: "Cocacola", nombre: "Coca-Cola", stock: 5, unidad: "UNIDAD", stockMinimo: 5 },
  { excel: "Manzana", nombre: "Gaseosa Manzana", stock: 13, unidad: "UNIDAD", stockMinimo: 5 },
  { excel: "Colombiana", nombre: "Colombiana", stock: 2, unidad: "UNIDAD", stockMinimo: 5, nota: "por debajo del mínimo: el Excel ya la marcaba como COMPRAR" },

  // ── Desechables y empaque ──────────────────────────────────────────────
  { excel: "Papel p grande", nombre: "Papel para papas grande", stock: 57, unidad: "UNIDAD", stockMinimo: 10 },
  { excel: "Papel p pequeño", nombre: "Papel para papas pequeño", stock: 37, unidad: "UNIDAD", stockMinimo: 10 },
  { excel: "Caja de perro", nombre: "Caja de perro", stock: 11, unidad: "UNIDAD", stockMinimo: 10, nota: "el Excel la medía en 'gramos'; se cargó como unidades" },
  { excel: "Bolsa de papel gr", nombre: "Bolsa de papel grande", stock: 112, unidad: "UNIDAD", stockMinimo: 10 },
  { excel: "Bolsa parafinada", nombre: "Bolsa parafinada", stock: 16, unidad: "UNIDAD", stockMinimo: 10 },
  { excel: "Bolsa hermetica gr", nombre: "Bolsa hermética grande", stock: 80, unidad: "UNIDAD", stockMinimo: 10 },
  { excel: "Bolsa de basura", nombre: "Bolsa de basura", stock: 12, unidad: "UNIDAD", stockMinimo: 3 },
  { excel: "Copas de salsa", nombre: "Copas de salsa", stock: 100, unidad: "UNIDAD", stockMinimo: 20 },
  { excel: "Bandeja 7", nombre: "Bandeja 7", stock: 26, unidad: "UNIDAD", stockMinimo: 10 },
  { excel: "Palillo hamburguesa", nombre: "Palillo de hamburguesa", stock: 112, unidad: "UNIDAD", stockMinimo: 10 },

  // ── Otros ──────────────────────────────────────────────────────────────
  { excel: "Huevo Sorpresa", nombre: "Huevo Sorpresa", stock: 9, unidad: "UNIDAD", stockMinimo: 3 },
];

/**
 * Insumos que la cocina prepara mezclando otros. Ya existían en la base pero
 * ninguno estaba marcado como elaborado, así que la pestaña de Producción no
 * los ofrecía y su composición nunca se descontaba.
 *
 * Solo se marca la propiedad. Las cantidades de cada componente NO se inventan
 * aquí: hay que medirlas una vez en cocina y cargarlas desde el panel.
 */
const ELABORADOS = ["Aderezo", "Cebolla caramelizada"];

async function main() {
  const aplicar = process.argv.includes("--aplicar");

  const existentes = await prisma.insumo.findMany();
  const porNombre = new Map(existentes.map((i) => [i.nombre.toLowerCase(), i]));

  const creados: string[] = [];
  const actualizados: string[] = [];
  const ajustes: { nombre: string; de: number; a: number }[] = [];
  const avisos: string[] = [];

  // Detecta a tiempo un mapeo mal escrito: si `fusionarCon` no existe en la
  // base, la fila crearía un insumo duplicado en silencio y las recetas
  // seguirían apuntando al viejo.
  for (const fila of INVENTARIO) {
    if (fila.fusionarCon && !porNombre.has(fila.fusionarCon.toLowerCase())) {
      throw new Error(
        `El insumo "${fila.fusionarCon}" (mapeado desde "${fila.excel}") no existe en la base. Revisa el mapeo antes de continuar.`
      );
    }
  }

  const nombresVistos = new Set<string>();
  for (const fila of INVENTARIO) {
    const destino = (fila.fusionarCon ?? fila.nombre).toLowerCase();
    if (nombresVistos.has(destino)) {
      throw new Error(`Dos filas del Excel apuntan al mismo insumo "${destino}". Revisa el mapeo.`);
    }
    nombresVistos.add(destino);
  }

  for (const fila of INVENTARIO) {
    const previo = porNombre.get((fila.fusionarCon ?? fila.nombre).toLowerCase());

    if (previo) {
      actualizados.push(`${fila.excel} → ${previo.nombre}`);
      if (previo.unidad !== fila.unidad) {
        avisos.push(`"${previo.nombre}": unidad ${previo.unidad} → ${fila.unidad}`);
      }
      if (aplicar) {
        await prisma.insumo.update({
          where: { id: previo.id },
          data: { unidad: fila.unidad, stockMinimo: fila.stockMinimo, activo: true },
        });
      }
      if (previo.stockActual !== fila.stock) {
        ajustes.push({ nombre: previo.nombre, de: previo.stockActual, a: fila.stock });
        if (aplicar) await registrarAjuste(previo.id, previo.stockActual, fila.stock, previo.costoUnitario);
      }
    } else {
      creados.push(fila.nombre);
      if (aplicar) {
        const nuevo = await prisma.insumo.create({
          data: { nombre: fila.nombre, unidad: fila.unidad, stockMinimo: fila.stockMinimo, stockActual: 0, costoUnitario: 0 },
        });
        if (fila.stock !== 0) await registrarAjuste(nuevo.id, 0, fila.stock, 0);
      }
      if (fila.stock !== 0) ajustes.push({ nombre: fila.nombre, de: 0, a: fila.stock });
    }

    if (fila.nota) avisos.push(`"${fila.nombre}": ${fila.nota}`);
  }

  // Elaborados
  const marcados: string[] = [];
  for (const nombre of ELABORADOS) {
    const insumo = porNombre.get(nombre.toLowerCase());
    if (!insumo) {
      avisos.push(`No se encontró el elaborado "${nombre}" para marcarlo.`);
      continue;
    }
    if (!insumo.esElaborado) {
      marcados.push(insumo.nombre);
      if (aplicar) await prisma.insumo.update({ where: { id: insumo.id }, data: { esElaborado: true } });
    }
  }

  // Insumos de la base que el Excel no menciona: quedan en 0 y conviene saberlo.
  const cubiertos = new Set(INVENTARIO.map((f) => (f.fusionarCon ?? f.nombre).toLowerCase()));
  const sinDatos = existentes.filter((i) => !cubiertos.has(i.nombre.toLowerCase())).map((i) => i.nombre);

  // ── Informe ────────────────────────────────────────────────────────────
  const linea = "─".repeat(64);
  console.log(`\n${linea}`);
  console.log(aplicar ? "CARGA APLICADA" : "SIMULACIÓN (no se escribió nada) — usa --aplicar para ejecutar");
  console.log(linea);

  console.log(`\nInsumos actualizados (fusionados con los existentes): ${actualizados.length}`);
  for (const a of actualizados) console.log(`  · ${a}`);

  console.log(`\nInsumos nuevos creados: ${creados.length}`);
  for (const c of creados) console.log(`  · ${c}`);

  console.log(`\nAjustes de stock registrados en el libro mayor: ${ajustes.length}`);
  for (const a of ajustes) console.log(`  · ${a.nombre}: ${a.de} → ${a.a}`);

  if (marcados.length > 0) {
    console.log(`\nMarcados como elaborados: ${marcados.join(", ")}`);
    console.log("  ⚠ Define su composición en /admin/inventario para poder registrar producciones.");
  }

  if (sinDatos.length > 0) {
    console.log(`\nInsumos de la base que el Excel NO menciona (quedan en 0): ${sinDatos.length}`);
    for (const s of sinDatos) console.log(`  · ${s}`);
  }

  if (avisos.length > 0) {
    console.log(`\nRevisar a ojo (${avisos.length}):`);
    for (const a of avisos) console.log(`  ⚠ ${a}`);
  }

  console.log(`\n${linea}`);
  console.log("El Excel no traía costos: `costoUnitario` sigue en 0 en los insumos nuevos.");
  console.log("Se llenará solo a medida que registres compras (costo promedio ponderado).");
  console.log(`${linea}\n`);
}

/**
 * Deja la carga inicial explicada en el libro mayor en vez de sobreescribir el
 * stock a mano. `costoUnitario` se guarda como snapshot para que el valor
 * histórico del movimiento no cambie si mañana sube el precio del insumo.
 */
async function registrarAjuste(insumoId: string, desde: number, hasta: number, costoUnitario: number) {
  await prisma.$transaction([
    prisma.insumo.update({ where: { id: insumoId }, data: { stockActual: hasta } }),
    prisma.movimientoInsumo.create({
      data: { insumoId, tipo: "AJUSTE", cantidad: hasta - desde, costoUnitario, motivo: MOTIVO },
    }),
  ]);
}

main()
  .catch((error) => {
    console.error("\nLa carga falló:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
