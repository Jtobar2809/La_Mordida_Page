import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MenuBrowser } from "@/components/menu/menu-browser";

export const revalidate = 30;

export const metadata = {
  title: "Menú | Hamburguesas y Perros Calientes en Popayán",
  description:
    "Explora el menú completo de La Mordida: hamburguesas y perros calientes artesanales en Popayán. Pide en línea y recibe a domicilio.",
  keywords: [
    "menú hamburguesas Popayán",
    "perros calientes Popayán",
    "comida rápida a domicilio Popayán",
    "pedir hamburguesas online Popayán",
  ],
  alternates: {
    canonical: "/menu",
  },
};

export default async function MenuPage() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    include: {
      products: {
        where: { available: true },
        orderBy: { name: "asc" },
        include: { extras: { where: { active: true } } },
      },
    },
  });

  const siteUrl = process.env.NEXTAUTH_URL ?? "https://la-mordida.vercel.app";

  // Datos estructurados del menú: le da a Google los nombres, descripciones
  // y precios de cada producto para posibles rich snippets de "menú" / precio.
  const menuJsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: "Menú La Mordida",
    url: `${siteUrl}/menu`,
    hasMenuSection: categories.map((cat) => ({
      "@type": "MenuSection",
      name: cat.name,
      hasMenuItem: cat.products.map((p) => ({
        "@type": "MenuItem",
        name: p.name,
        description: p.description,
        offers: {
          "@type": "Offer",
          price: p.price,
          priceCurrency: "COP",
        },
      })),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd) }}
      />
      <Navbar />
      <main className="min-h-screen">
        <div className="bg-char-gradient py-16 text-cream">
          <div className="container-lm">
            <p className="eyebrow mb-3">El menú completo</p>
            <h1 className="font-display text-5xl tracking-wide sm:text-6xl">HAZ TU PEDIDO</h1>
            <p className="mt-4 max-w-xl text-charcoal-200">
              Hamburguesas y perros calientes artesanales en Popayán. Pide en línea y recibe a domicilio.
            </p>
          </div>
        </div>
        <div className="container-lm py-12">
          <MenuBrowser categories={categories} />
        </div>
      </main>
      <Footer />
    </>
  );
}
