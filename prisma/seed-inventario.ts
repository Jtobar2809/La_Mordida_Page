import { PrismaClient, UnidadInsumo } from "@prisma/client";

const prisma = new PrismaClient();

const insumosBase: {
  nombre: string;
  unidad: UnidadInsumo;
  esElaborado?: boolean;
}[] = [
  { nombre: "Pan brioche", unidad: "UNIDAD" },
  { nombre: "Pan pretzel", unidad: "UNIDAD" },
  { nombre: "Carne artesanal", unidad: "GRAMOS" },
  { nombre: "Cebolla caramelizada", unidad: "GRAMOS", esElaborado: true },
  { nombre: "Cebolla crispy", unidad: "GRAMOS" },
  { nombre: "Jamón", unidad: "GRAMOS" },
  { nombre: "Queso fundido", unidad: "GRAMOS" },
  { nombre: "Queso doble crema", unidad: "GRAMOS" },
  { nombre: "Queso mozzarella", unidad: "GRAMOS" },
  { nombre: "Tocineta", unidad: "GRAMOS" },
  { nombre: "Chorizo", unidad: "GRAMOS" },
  { nombre: "Lechuga", unidad: "GRAMOS" },
  { nombre: "Tomate", unidad: "GRAMOS" },
  { nombre: "Aderezo", unidad: "GRAMOS", esElaborado: true },
  { nombre: "Piña asada", unidad: "GRAMOS" },
  { nombre: "Piña calada", unidad: "GRAMOS" },
  { nombre: "Salchicha americana", unidad: "UNIDAD" },
  { nombre: "Ripio de papa", unidad: "GRAMOS" },
  { nombre: "Huevo de codorniz", unidad: "UNIDAD" },
  { nombre: "Papa fresca", unidad: "GRAMOS" },
  { nombre: "Especias artesanales", unidad: "GRAMOS" },

  { nombre: "Pepinillos", unidad: "GRAMOS" },
  { nombre: "Mayonesa", unidad: "GRAMOS" },
  { nombre: "Mostaza", unidad: "GRAMOS" },
  { nombre: "Salsa de tomate", unidad: "GRAMOS" },
  { nombre: "Sal", unidad: "GRAMOS" },
  { nombre: "Miel", unidad: "GRAMOS" },
  { nombre: "Cebolla en polvo", unidad: "GRAMOS" },
  { nombre: "Ajo en polvo", unidad: "GRAMOS" },

  { nombre: "Cebolla", unidad: "GRAMOS" },
  { nombre: "Azúcar", unidad: "GRAMOS" },
  { nombre: "Salsa de humo", unidad: "GRAMOS" },
  { nombre: "Salsa BBQ", unidad: "GRAMOS" },
];

const composiciones: Record<string, [string, number][]> = {
  Aderezo: [
    ["Mayonesa", 1],
    ["Mostaza", 1],
    ["Salsa de tomate", 1],
    ["Pepinillos", 1],
    ["Sal", 1],
    ["Miel", 1],
    ["Cebolla en polvo", 1],
    ["Ajo en polvo", 1],
  ],

  "Cebolla caramelizada": [
    ["Cebolla", 1],
    ["Sal", 1],
    ["Azúcar", 1],
    ["Tocineta", 1],
    ["Salsa de humo", 1],
    ["Salsa BBQ", 1],
  ],
};

const recetas: Record<string, [string, number][]> = {
  "la-clasica": [
    ["Pan brioche", 1],
    ["Carne artesanal", 1],
    ["Cebolla caramelizada", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Lechuga", 1],
    ["Tomate", 1],
    ["Aderezo", 1],
  ],

  aloha: [
    ["Pan brioche", 1],
    ["Carne artesanal", 1],
    ["Cebolla caramelizada", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Lechuga", 1],
    ["Tomate", 1],
    ["Piña asada", 1],
    ["Aderezo", 1],
  ],

  "bacon-boom": [
    ["Pan brioche", 1],
    ["Carne artesanal", 1],
    ["Cebolla caramelizada", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Tocineta", 1],
    ["Lechuga", 1],
    ["Tomate", 1],
    ["Aderezo", 1],
  ],

  "doble-impacto": [
    ["Pan brioche", 1],
    ["Carne artesanal", 2],
    ["Cebolla caramelizada", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Lechuga", 1],
    ["Tomate", 1],
    ["Aderezo", 1],
  ],

  crunch: [
    ["Pan brioche", 1],
    ["Carne artesanal", 1],
    ["Cebolla caramelizada", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Tocineta", 1],
    ["Cebolla crispy", 1],
    ["Lechuga", 1],
    ["Tomate", 1],
    ["Aderezo", 1],
  ],

  "triple-impacto": [
    ["Pan brioche", 1],
    ["Carne artesanal", 3],
    ["Cebolla caramelizada", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Lechuga", 1],
    ["Tomate", 1],
    ["Aderezo", 1],
  ],

  "la-mordida": [
    ["Pan pretzel", 1],
    ["Carne artesanal", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Queso doble crema", 1],
    ["Queso mozzarella", 1],
    ["Tocineta", 1],
    ["Chorizo", 1],
    ["Lechuga", 1],
    ["Tomate", 1],
    ["Aderezo", 1],
  ],

  "el-clasico": [
    ["Pan brioche", 1],
    ["Salchicha americana", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Ripio de papa", 1],
    ["Aderezo", 1],
  ],

  "aloha-dog": [
    ["Pan brioche", 1],
    ["Salchicha americana", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Ripio de papa", 1],
    ["Piña calada", 1],
    ["Aderezo", 1],
  ],

  "bacon-dog": [
    ["Pan brioche", 1],
    ["Salchicha americana", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Tocineta", 1],
    ["Ripio de papa", 1],
    ["Aderezo", 1],
  ],

  "la-mordida-dog": [
    ["Pan brioche", 1],
    ["Salchicha americana", 1],
    ["Tocineta", 1],
    ["Jamón", 1],
    ["Queso fundido", 1],
    ["Queso doble crema", 1],
    ["Queso mozzarella", 1],
    ["Cebolla crispy", 1],
    ["Huevo de codorniz", 1],
    ["Ripio de papa", 1],
    ["Aderezo", 1],
  ],

  "papas-a-la-francesa": [
    ["Papa fresca", 1],
    ["Especias artesanales", 1],
  ],
};

function obtenerInsumoId(
  insumoIds: Record<string, string>,
  nombre: string,
): string {
  const id = insumoIds[nombre];

  if (!id) {
    throw new Error(
      `No se encontró el insumo "${nombre}" en insumosBase. ` +
        `Revisa que el nombre esté escrito exactamente igual.`,
    );
  }

  return id;
}

async function main() {
  console.log("Sembrando módulo de inventario...");

  const insumoIds: Record<string, string> = {};

  for (const insumo of insumosBase) {
    const created = await prisma.insumo.upsert({
      where: {
        nombre: insumo.nombre,
      },
      update: {
        unidad: insumo.unidad,
        esElaborado: insumo.esElaborado ?? false,
      },
      create: {
        nombre: insumo.nombre,
        unidad: insumo.unidad,
        esElaborado: insumo.esElaborado ?? false,
      },
    });

    insumoIds[insumo.nombre] = created.id;
  }

  console.log(
    `${insumosBase.length} insumos base sincronizados.`,
  );

  let componentesCreados = 0;

  for (const [nombreElaborado, items] of Object.entries(composiciones)) {
    const insumoElaboradoId = obtenerInsumoId(
      insumoIds,
      nombreElaborado,
    );

    for (const [nombreBase, cantidad] of items) {
      const insumoBaseId = obtenerInsumoId(
        insumoIds,
        nombreBase,
      );

      await prisma.insumoComponente.upsert({
        where: {
          insumoElaboradoId_insumoBaseId: {
            insumoElaboradoId,
            insumoBaseId,
          },
        },
        update: {
          cantidad,
        },
        create: {
          insumoElaboradoId,
          insumoBaseId,
          cantidad,
        },
      });

      componentesCreados++;
    }
  }

  console.log(
    `${componentesCreados} componentes de insumos elaborados sincronizados.`,
  );

  let recetasCreadas = 0;

  for (const [slug, items] of Object.entries(recetas)) {
    const product = await prisma.product.findUnique({
      where: {
        slug,
      },
    });

    if (!product) {
      console.warn(
        `No se encontró el producto con slug "${slug}", se omite su receta.`,
      );
      continue;
    }

    for (const [nombreInsumo, cantidad] of items) {
      const insumoId = obtenerInsumoId(
        insumoIds,
        nombreInsumo,
      );

      await prisma.recetaItem.upsert({
        where: {
          productId_insumoId: {
            productId: product.id,
            insumoId,
          },
        },
        update: {
          cantidad,
        },
        create: {
          productId: product.id,
          insumoId,
          cantidad,
        },
      });

      recetasCreadas++;
    }
  }

  console.log(
    `${recetasCreadas} líneas de receta creadas/actualizadas.`,
  );

  console.log(
    `Se revisaron ${Object.keys(recetas).length} productos configurados.`,
  );

  console.log("");
  console.log("Pendientes manuales:");
  console.log(
    '1. La receta de "La Mordida" no incluye cebolla crispy/caramelizada porque el cliente puede elegir.',
  );
  console.log(
    "2. Las cantidades están en 1 como placeholder. Ajusta los gramos reales.",
  );
  console.log(
    "3. Completa stock, stock mínimo y costos desde /admin/inventario.",
  );

  console.log("");
  console.log("Inventario sembrado correctamente.");
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed-inventario:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });