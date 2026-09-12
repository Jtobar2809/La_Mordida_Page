import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🔥 Sembrando datos de La Mordida...");

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
    },
  });
  console.log("✅ Usuario cliente de prueba creado (cliente@lamordida.com / Cliente123!)");

  // ── Categorías ───────────────────────────────────────
  const categoriesData = [
    { name: "Hamburguesas", slug: "hamburguesas", icon: "beef", order: 0 },
    { name: "Combos", slug: "combos", icon: "package", order: 1 },
    { name: "Acompañamientos", slug: "acompanamientos", icon: "utensils", order: 2 },
    { name: "Menú Infantil", slug: "menu-infantil", icon: "baby", order: 3 },
    { name: "Bebidas", slug: "bebidas", icon: "cup-soda", order: 4 },
    { name: "Adicionales", slug: "adicionales", icon: "plus-circle", order: 5 },
  ];
  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({ where: { slug: cat.slug }, update: cat, create: cat });
    categories[cat.slug] = created.id;
  }
  await prisma.category.updateMany({ where: { slug: "perros-artesanales" }, data: { active: false } });
  console.log("✅ Categorías creadas");

  // ── Productos ────────────────────────────────────────
  const productsData = [
    {
      name: "La Clásica",
      slug: "la-clasica",
      description: "Pan brioche sellado en mantequilla de ajo, carne 100 % artesanal, cebolla caramelizada, jamón, queso fundido, lechuga, tomate y aderezo de la casa.",
      price: 20000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Lechuga", "Tomate", "Aderezo"],
      featured: true,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }, { name: "Tocineta", price: 4000 }, { name: "Extra carne", price: 8000 }],
    },
    {
      name: "Aloha",
      slug: "aloha",
      description: "Pan brioche sellado en mantequilla de ajo, carne 100 % artesanal, cebolla caramelizada, jamón, queso fundido, lechuga, tomate, piña asada y aderezo de la casa.",
      price: 22000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Lechuga", "Tomate", "Piña asada", "Aderezo"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }, { name: "Tocineta", price: 4000 }],
    },
    {
      name: "Bacon Boom",
      slug: "bacon-boom",
      description: "Pan brioche sellado en mantequilla de ajo, carne 100% artesanal, cebolla caramelizada, jamón, queso fundido, tocineta, lechuga, tomate y aderezo de la casa.",
      price: 25000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Tocineta", "Lechuga", "Tomate", "Aderezo"],
      featured: true,
      spicyLevel: 0,
      extras: [{ name: "Extra tocineta", price: 4000 }, { name: "Extra queso", price: 3000 }],
    },
    {
      name: "Doble Impacto",
      slug: "doble-impacto",
      description: "Pan brioche sellado en mantequilla de ajo, doble carne 100 % artesanal, cebolla caramelizada, jamón, queso fundido, lechuga, tomate y aderezo de la casa.",
      price: 26000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Doble carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Lechuga", "Tomate", "Aderezo"],
      featured: true,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }, { name: "Tocineta", price: 4000 }],
    },
    {
      name: "Crunch",
      slug: "crunch",
      description: "Pan brioche sellado en mantequilla de ajo, carne 100 % artesanal, cebolla caramelizada, jamón, queso fundido, tocineta, cebolla crispy, lechuga, tomate y aderezo de la casa.",
      price: 26000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Tocineta", "Cebolla crispy", "Lechuga", "Tomate", "Aderezo"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }],
    },
    {
      name: "Triple Impacto",
      slug: "triple-impacto",
      description: "Pan brioche sellado en mantequilla de ajo, triple carne 100 % artesanal, cebolla caramelizada, jamón, queso fundido, lechuga, tomate y aderezo de la casa.",
      price: 32000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan brioche", "Triple carne artesanal", "Cebolla caramelizada", "Jamón", "Queso fundido", "Lechuga", "Tomate", "Aderezo"],
      featured: false,
      spicyLevel: 0,
      extras: [{ name: "Extra queso", price: 3000 }],
    },
    {
      name: "La Mordida",
      slug: "la-mordida",
      description: "Pan pretzel sellado en mantequilla de ajo, carne 100% artesanal, cebolla crispy o caramelizada (a elección), jamón, queso fundido, queso doble crema, queso mozzarella, tocineta, chorizo, lechuga, tomate y aderezo de la casa.",
      price: 34000,
      categorySlug: "hamburguesas",
      ingredients: ["Pan pretzel", "Carne artesanal", "Cebolla crispy o caramelizada", "Jamón", "Queso fundido", "Queso doble crema", "Queso mozzarella", "Tocineta", "Chorizo", "Lechuga", "Tomate", "Aderezo"],
      featured: true,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Combo La Clásica",
      slug: "combo-la-clasica",
      description: "La Clásica + papas a la francesa + gaseosa 250ml.",
      price: 32000,
      categorySlug: "combos",
      ingredients: ["La Clásica", "Papas a la francesa", "Gaseosa 250ml"],
      featured: true,
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
      name: "La Mini Clásica",
      slug: "la-mini-clasica",
      description: "Versión pequeña de La Clásica, papas a la francesa, agua o jugo Hit en cajita y un huevo Kinder Joy de regalo.",
      price: 18000,
      categorySlug: "menu-infantil",
      ingredients: ["Mini hamburguesa", "Papas a la francesa", "Agua o jugo Hit en cajita", "Huevo Kinder Joy"],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Gaseosa 250ml Coca-Cola",
      slug: "gaseosa-250ml-coca-cola",
      description: "Coca-Cola personal de 250ml, bien fría.",
      price: 4000,
      categorySlug: "bebidas",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Gaseosa 250ml Postobón",
      slug: "gaseosa-250ml-postobon",
      description: "Postobón personal de 250ml, elige tu sabor favorito.",
      price: 4000,
      categorySlug: "bebidas",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Agua 250ml",
      slug: "agua-250ml",
      description: "Agua personal de 250ml.",
      price: 2500,
      categorySlug: "bebidas",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Carne adicional",
      slug: "adicional-carne",
      description: "Una porción extra de carne artesanal para agregar a tu pedido.",
      price: 6000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Cebolla crispy",
      slug: "adicional-cebolla-crispy",
      description: "Porción extra de cebolla crispy.",
      price: 3000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Cebolla caramelizada",
      slug: "adicional-cebolla-caramelizada",
      description: "Porción extra de cebolla caramelizada.",
      price: 3000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Aderezo de la casa",
      slug: "adicional-aderezo-de-la-casa",
      description: "Porción extra de nuestro aderezo de la casa.",
      price: 3000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Queso x1",
      slug: "adicional-queso-x1",
      description: "Una tajada extra de queso fundido.",
      price: 2000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Queso x2",
      slug: "adicional-queso-x2",
      description: "Dos tajadas extra de queso fundido.",
      price: 3000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Queso x3",
      slug: "adicional-queso-x3",
      description: "Tres tajadas extra de queso fundido.",
      price: 3500,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Tocineta x1",
      slug: "adicional-tocineta-x1",
      description: "Una porción extra de tocineta.",
      price: 3500,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Tocineta x2",
      slug: "adicional-tocineta-x2",
      description: "Dos porciones extra de tocineta.",
      price: 6000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Piña asada",
      slug: "adicional-pina-asada",
      description: "Porción extra de piña asada.",
      price: 2000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Piña calada",
      slug: "adicional-pina-calada",
      description: "Porción extra de piña calada.",
      price: 2000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
    {
      name: "Huevo de codorniz x2",
      slug: "adicional-huevo-de-codorniz-x2",
      description: "Dos huevos de codorniz extra.",
      price: 1000,
      categorySlug: "adicionales",
      ingredients: [],
      featured: false,
      spicyLevel: 0,
      extras: [],
    },
  ];
  await prisma.product.deleteMany({
    where: { slug: { in: ["la-ahumada-bbq", "la-picante-jalapeno", "la-clasica-de-pollo", "perro-clasico", "perro-ranchero"] } },
  });
  await prisma.product.updateMany({
    where: { slug: { in: ["el-clasico", "aloha-dog", "bacon-dog", "la-mordida-dog"] } },
    data: { available: false, featured: false },
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
  await prisma.review.deleteMany({
    where: {
      OR: [
        { comment: { contains: "programa de puntos", mode: "insensitive" } },
        { comment: { contains: "perros artesanales", mode: "insensitive" } },
        { comment: { contains: "nivel Plata", mode: "insensitive" } },
      ],
    },
  });
  const reviewsData = [
    { authorName: "Camila R.", rating: 5, comment: "La Ahumada BBQ es una locura, el mejor sabor ahumado que he probado en Popayán." },
    { authorName: "Andrés G.", rating: 5, comment: "Se nota que la carne es fresca. Además la tarjeta de sellos es un plus increíble." },
    { authorName: "Valentina M.", rating: 4, comment: "La Bacon Boom es mi favorita: tocineta generosa y pan suave." },
    { authorName: "Julián T.", rating: 5, comment: "Pedí por WhatsApp y todo fue súper rápido. Ya casi lleno mi tarjeta de sellos." },
    { authorName: "Laura P.", rating: 5, comment: "El combo rinde bastante y las papas quedan bien crocantes." },
    { authorName: "Santiago V.", rating: 4, comment: "Muy buena atención y las hamburguesas llegan calientitas." },
  ];
  for (const review of reviewsData) {
    await prisma.review.create({ data: review });
  }
  console.log("✅ Reseñas creadas");

  // ── Cupón de ejemplo ─────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "BIENVENIDA10" },
    update: {},
    create: { code: "BIENVENIDA10", discountType: "PORCENTAJE", value: 10, minOrder: 20000, usageLimit: 500 },
  });
  console.log("✅ Cupón de bienvenida creado (BIENVENIDA10)");

  // ── Banners de ejemplo ───────────────────────────────
  await prisma.banner.deleteMany({
    where: { title: { contains: "perros", mode: "insensitive" } },
  });
  const bannersData = [
    {
      title: "Combo Ahumada BBQ",
      subtitle: "Hamburguesa + papas + gaseosa por $38.000",
      image: "https://images.unsplash.com/photo-1594007654729-407eedc4be65?q=80&w=1200",
      link: "/menu",
      order: 0,
    },
    {
      title: "Tarjeta de sellos",
      subtitle: "Junta 7 sellos y reclama una hamburguesa gratis",
      image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=1200",
      link: "/menu",
      order: 1,
    },
  ];
  for (const banner of bannersData) {
    const existing = await prisma.banner.findFirst({ where: { title: banner.title } });
    if (!existing) await prisma.banner.create({ data: banner });
  }
  console.log("✅ Banners de ejemplo creados");

  // ── Galería de ejemplo ───────────────────────────────
  await prisma.galleryImage.deleteMany({
    where: { alt: { contains: "perro", mode: "insensitive" } },
  });
  const galleryData = [
    { image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?q=80&w=800", alt: "Hamburguesa artesanal doble", order: 0, active: true },
    { image: "https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600", alt: "Hamburguesa artesanal con queso", order: 1, active: true },
    { image: "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?q=80&w=600", alt: "Papas a la francesa", order: 2, active: true },
    { image: "https://images.unsplash.com/photo-1610614819513-58e34989e371?q=80&w=600", alt: "Carne a la parrilla", order: 3, active: true },
  ];
  for (const g of galleryData) {
    const existing = await prisma.galleryImage.findFirst({ where: { image: g.image } });
    if (!existing) await prisma.galleryImage.create({ data: g });
  }
  console.log("✅ Galería de ejemplo creada");

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

