import { PrismaClient, ChallengeType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🔥 Sembrando datos de La Mordida...");

  // ── Niveles ──────────────────────────────────────────
  const levelsData = [
    { name: "Bronce", minPoints: 0, multiplier: 1, color: "#B45309", icon: "medal", order: 0, benefits: ["Acceso al programa de puntos", "Ofertas de cumpleaños"] },
    { name: "Plata", minPoints: 200, multiplier: 1.1, color: "#94A3B8", icon: "award", order: 1, benefits: ["10% más puntos por compra", "Acceso anticipado a promos"] },
    { name: "Oro", minPoints: 600, multiplier: 1.25, color: "#F0A93A", icon: "flame", order: 2, benefits: ["25% más puntos por compra", "Regalo de cumpleaños", "Línea de pedidos prioritaria"] },
    { name: "Diamante", minPoints: 1500, multiplier: 1.5, color: "#38BDF8", icon: "gem", order: 3, benefits: ["50% más puntos por compra", "Invitación a eventos VIP", "Postre gratis cada mes"] },
  ];
  for (const level of levelsData) {
    await prisma.level.upsert({ where: { name: level.name }, update: level, create: level });
  }
  const bronce = await prisma.level.findUniqueOrThrow({ where: { name: "Bronce" } });
  console.log("✅ Niveles creados");

  // ── Usuario admin ────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin123!", 10);
  await prisma.user.upsert({
    where: { email: "admin@lamordida.com" },
    update: {},
    create: {
      name: "Administrador La Mordida",
      email: "admin@lamordida.com",
      password: adminPassword,
      phone: "3000000000",
      role: "ADMIN",
      levelId: bronce.id,
    },
  });
  console.log("✅ Usuario admin creado (admin@lamordida.com / Admin123!)");

  // ── Cliente de prueba ────────────────────────────────
  const clientPassword = await bcrypt.hash("Cliente123!", 10);
  await prisma.user.upsert({
    where: { email: "cliente@lamordida.com" },
    update: {},
    create: {
      name: "Cliente de Prueba",
      email: "cliente@lamordida.com",
      password: clientPassword,
      phone: "3001234567",
      role: "CLIENTE",
      points: 45,
      levelId: bronce.id,
    },
  });
  console.log("✅ Usuario cliente de prueba creado (cliente@lamordida.com / Cliente123!)");

  // ── Categorías ───────────────────────────────────────
  const categoriesData = [
    { name: "Hamburguesas", slug: "hamburguesas", icon: "beef", order: 0 },
    { name: "Hot Dogs", slug: "perros-artesanales", icon: "hotdog", order: 1 },
    { name: "Combos", slug: "combos", icon: "package", order: 2 },
    { name: "Acompañamientos", slug: "acompanamientos", icon: "utensils", order: 3 },
    { name: "Bebidas", slug: "bebidas", icon: "cup-soda", order: 4 },
  ];
  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({ where: { slug: cat.slug }, update: cat, create: cat });
    categories[cat.slug] = created.id;
  }
  console.log("✅ Categorías creadas");

  // ── Productos ────────────────────────────────────────
  const productsData = [
    {
      name: "La Clásica",
      slug: "la-clasica",
      description: "Pan brioche, carne artesanal, cebolla caramelizada, jamón, queso fundido, lechuga, tomate y salsa de la casa.",
      price: 20000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Lechuga", "Tomate", "Salsa de la casa"],
      featured: true,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }, { name: "Tocineta", price: 4000 }, { name: "Extra carne", price: 8000 }],
    },
    {
      name: "Aloha",
      slug: "aloha",
      description: "Pan brioche, carne artesanal, cebolla caramelizada, jamón, queso fundido, lechuga, tomate, piña asada y salsa de la casa.",
      price: 22000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Lechuga", "Tomate", "Piña asada", "Salsa de la casa"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }, { name: "Tocineta", price: 4000 }],
    },
    {
      name: "Bacon Boom",
      slug: "bacon-boom",
      description: "Pan brioche, carne artesanal, cebolla caramelizada, jamón, queso fundido, tocineta, lechuga, tomate y salsa de la casa.",
      price: 24000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Tocineta", "Lechuga", "Tomate", "Salsa de la casa"],
      featured: true,
      spicyLevel: 0,
      extras: [{ name: "Extra tocineta", price: 4000 }, { name: "Extra queso", price: 3000 }],
    },
    {
      name: "Doble Impacto",
      slug: "doble-impacto",
      description: "Pan brioche, doble carne artesanal, cebolla caramelizada, jamón, queso fundido, lechuga, tomate y salsa de la casa.",
      price: 24000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Doble carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Lechuga", "Tomate", "Salsa de la casa"],
      featured: true,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }, { name: "Tocineta", price: 4000 }],
    },
    {
      name: "Crunch",
      slug: "crunch",
      description: "Pan brioche, carne artesanal, cebolla caramelizada, jamón, queso fundido, tocineta, cebolla crispy, lechuga, tomate y salsa de la casa.",
      price: 26000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Tocineta", "Cebolla crispy", "Lechuga", "Tomate", "Salsa de la casa"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }],
    },
    {
      name: "Triple Impacto",
      slug: "triple-impacto",
      description: "Pan brioche, triple carne artesanal, cebolla caramelizada, jamón, queso fundido, lechuga, tomate y salsa de la casa.",
      price: 28000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Triple carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Lechuga", "Tomate", "Salsa de la casa"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }],
    },
    {
      name: "La Mordida",
      slug: "la-mordida",
      description: "Pan negro, carne artesanal, cebolla crispy o caramelizada (a elección), jamón, queso fundido, queso doble crema, queso mozzarella, tocineta, chorizo, lechuga, tomate y salsa de la casa.",
      price: 32000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan negro", "Carne artesanal", "Cebolla crispy o caramelizada", "Jamón", "Queso fundido", "Queso doble crema", "Queso mozzarella", "Tocineta", "Chorizo", "Lechuga", "Tomate", "Salsa de la casa"],
      featured: true,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "El Clásico",
      slug: "el-clasico",
      description: "Pan brioche, salchicha americana, jamón, queso fundido, ripio de papa y salsa de la casa.",
      price: 18000,
      categorySlug: "perros-artesanales",
      ingredients: ["Pan brioche", "Salchicha americana", "Jamón", "Queso fundido", "Ripio de papa", "Salsa de la casa"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 2500 }, { name: "Tocineta", price: 3500 }],
    },
    {
      name: "Aloha Dog",
      slug: "aloha-dog",
      description: "Pan brioche, salchicha americana, jamón, queso fundido, ripio de papa, piña calada y salsa de la casa.",
      price: 20000,
      categorySlug: "perros-artesanales",
      ingredients: ["Pan brioche", "Salchicha americana", "Jamón", "Queso fundido", "Ripio de papa", "Piña calada", "Salsa de la casa"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 2500 }],
    },
    {
      name: "Bacon Dog",
      slug: "bacon-dog",
      description: "Pan brioche, salchicha americana, jamón, queso fundido, tocineta, ripio de papa y salsa de la casa.",
      price: 22000,
      categorySlug: "perros-artesanales",
      ingredients: ["Pan brioche", "Salchicha americana", "Jamón", "Queso fundido", "Tocineta", "Ripio de papa", "Salsa de la casa"],
      featured: true,
      spicyLevel: 0,
      extras: [{ name: "Extra tocineta", price: 3500 }],
    },
    {
      name: "La Mordida Dog",
      slug: "la-mordida-dog",
      description: "Pan brioche, salchicha americana envuelta en tocineta, jamón, queso fundido, queso doble crema, queso mozzarella, cebolla crispy, huevo de codorniz, ripio de papa y salsa de la casa.",
      price: 26000,
      categorySlug: "perros-artesanales",
      ingredients: ["Pan brioche", "Salchicha americana envuelta en tocineta", "Jamón", "Queso fundido", "Queso doble crema", "Queso mozzarella", "Cebolla crispy", "Huevo de codorniz", "Ripio de papa", "Salsa de la casa"],
      featured: true,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Combo La Clásica",
      slug: "combo-la-clasica",
      description: "La Clásica + papas a la francesa + gaseosa de 400ml.",
      price: 32000,
      categorySlug: "combos",
      ingredients: ["La Clásica", "Papas a la francesa", "Gaseosa 400ml"],
      featured: true,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Combo Ahumada BBQ",
      slug: "combo-ahumada-bbq",
      description: "La Ahumada BBQ + papas a la francesa + gaseosa de 400ml.",
      price: 38000,
      categorySlug: "combos",
      ingredients: ["La Ahumada BBQ", "Papas a la francesa", "Gaseosa 400ml"],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Papas a la francesa",
      slug: "papas-a-la-francesa",
      description: "Papas crocantes por fuera, suaves por dentro, sazonadas con nuestras especias artesanales.",
      price: 9000,
      categorySlug: "acompanamientos",
      ingredients: ["Papa fresca", "Especias artesanales"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Con queso cheddar", price: 3500 }],
    },
    {
      name: "Aros de cebolla",
      slug: "aros-de-cebolla",
      description: "Aros de cebolla empanizados y fritos hasta quedar dorados y crocantes.",
      price: 10000,
      categorySlug: "acompanamientos",
      ingredients: ["Cebolla", "Empanizado artesanal"],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Limonada de coco",
      slug: "limonada-de-coco",
      description: "Limonada natural con un toque cremoso de coco, preparada al momento.",
      price: 8000,
      categorySlug: "bebidas",
      ingredients: ["Limón", "Coco", "Hielo"],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Gaseosa 400ml",
      slug: "gaseosa-400ml",
      description: "Elige tu sabor favorito, bien fría.",
      price: 5000,
      categorySlug: "bebidas",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
  ];
  await prisma.product.deleteMany({
    where: { slug: { in: ["la-ahumada-bbq", "la-picante-jalapeno", "la-clasica-de-pollo", "perro-clasico", "perro-ranchero"] } },
  });
  for (const { categorySlug, extras, ...product } of productsData) {
  const categoryId = categories[categorySlug];

  if (!categoryId) {
    throw new Error(`No existe la categoría: ${categorySlug}`);
  }

  await prisma.product.upsert({
    where: {
      slug: product.slug,
    },
    update: {
      ...product,
      categoryId,
    },
    create: {
      ...product,
      categoryId,
      extras: {
        create: extras,
      },
    },
  });
}
  console.log(`✅ ${productsData.length} productos creados`);

  // ── Reseñas ──────────────────────────────────────────
  const reviewsData = [
    { authorName: "Camila R.", rating: 5, comment: "La Ahumada BBQ es una locura, el mejor sabor ahumado que he probado en Popayán." },
    { authorName: "Andrés G.", rating: 5, comment: "Se nota que la carne es fresca. Además el programa de puntos es un plus increíble." },
    { authorName: "Valentina M.", rating: 4, comment: "Los perros artesanales son mi favorito, sobre todo el ranchero." },
    { authorName: "Julián T.", rating: 5, comment: "Pedí por WhatsApp y todo fue súper rápido. Ya subí a nivel Plata." },
    { authorName: "Laura P.", rating: 5, comment: "El combo rinde bastante y las papas quedan bien crocantes." },
    { authorName: "Santiago V.", rating: 4, comment: "Muy buena atención y las hamburguesas llegan calientitas." },
  ];
  for (const review of reviewsData) {
    await prisma.review.create({ data: review });
  }
  console.log("✅ Reseñas creadas");

  // ── Desafíos ─────────────────────────────────────────
  const challengesData = [
    { title: "Compra 5 hamburguesas", description: "Pide 5 unidades de cualquier hamburguesa y gana puntos extra.", type: ChallengeType.CANTIDAD_PRODUCTO, goal: 5, rewardPoints: 30, rewardDescription: "30 puntos extra" },
    { title: "Realiza 10 pedidos", description: "Haz 10 pedidos con nosotros (a domicilio o recogiendo en tienda).", type: ChallengeType.PEDIDOS_TOTALES, goal: 10, rewardPoints: 80, rewardDescription: "80 puntos extra" },
    { title: "3 semanas seguidas", description: "Haz al menos un pedido por semana durante 3 semanas consecutivas.", type: ChallengeType.RACHA_SEMANAS, goal: 3, rewardPoints: 50, rewardDescription: "50 puntos extra" },
    { title: "Prueba todo el menú", description: "Compra al menos un producto de cada categoría del menú.", type: ChallengeType.CATEGORIA_COMPLETA, goal: 5, rewardPoints: 60, rewardDescription: "60 puntos extra" },
    { title: "Mes de cumpleaños", description: "Haz un pedido durante el mes de tu cumpleaños y recibe puntos de regalo.", type: ChallengeType.CUMPLEANOS, goal: 1, rewardPoints: 40, rewardDescription: "40 puntos de regalo" },
  ];
  for (const challenge of challengesData) {
    const existing = await prisma.challenge.findFirst({ where: { title: challenge.title } });
    if (!existing) await prisma.challenge.create({ data: challenge });
  }
  console.log("✅ Desafíos creados");

  // ── Recompensas ──────────────────────────────────────
  const rewardsData = [
    { name: "Papas a la francesa gratis", description: "Canjea tus puntos por una orden de papas.", pointsCost: 40 },
    { name: "Gaseosa 400ml gratis", description: "Refréscate sin costo.", pointsCost: 25 },
    { name: "Perro Clásico gratis", description: "Un perro artesanal clásico, cortesía de la casa.", pointsCost: 90 },
    { name: "Hamburguesa La Clásica gratis", description: "Nuestra hamburguesa insignia, gratis con tus puntos.", pointsCost: 140 },
    { name: "20% de descuento en tu próximo pedido", description: "Aplica sobre el subtotal de tu siguiente compra.", pointsCost: 100 },
  ];
  for (const reward of rewardsData) {
    const existing = await prisma.reward.findFirst({ where: { name: reward.name } });
    if (!existing) await prisma.reward.create({ data: reward });
  }
  console.log("✅ Recompensas creadas");

  // ── Cupón de ejemplo ─────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "BIENVENIDA10" },
    update: {},
    create: { code: "BIENVENIDA10", discountType: "PORCENTAJE", value: 10, minOrder: 20000, usageLimit: 500 },
  });
  console.log("✅ Cupón de bienvenida creado (BIENVENIDA10)");

  // ── Banners de ejemplo ───────────────────────────────
  const bannersData = [
    {
      title: "Combo Ahumada BBQ",
      subtitle: "Hamburguesa + papas + gaseosa por $38.000",
      image: "https://images.unsplash.com/photo-1594007654729-407eedc4be65?q=80&w=1200",
      link: "/menu",
      order: 0,
    },
    {
      title: "2x1 en perros artesanales",
      subtitle: "Todos los martes de julio",
      image: "https://images.unsplash.com/photo-1612392062798-2dd67ddb7ec9?q=80&w=1200",
      link: "/menu",
      order: 1,
    },
  ];
  for (const banner of bannersData) {
    const existing = await prisma.banner.findFirst({ where: { title: banner.title } });
    if (!existing) await prisma.banner.create({ data: banner });
  }
  console.log("✅ Banners de ejemplo creados");

  console.log("🎉 Listo. Datos de La Mordida sembrados con éxito.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
