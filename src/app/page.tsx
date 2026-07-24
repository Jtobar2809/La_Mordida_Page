import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { Historia } from "@/components/home/historia";
import { Destacados } from "@/components/home/destacados";
import { Promociones } from "@/components/home/promociones";
import { PorQueElegirnos } from "@/components/home/por-que-elegirnos";
import { FidelizacionTeaser } from "@/components/home/fidelizacion-teaser";
import { JuegosSection } from "@/components/home/juegos-section";
import { Resenas } from "@/components/home/resenas";
import { Galeria } from "@/components/home/galeria";

export const revalidate = 60;

export default async function HomePage() {
  const [featuredProducts, reviews, banners] = await Promise.all([
    prisma.product.findMany({
      where: { featured: true, available: true },
      take: 6,
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.findMany({
      where: { approved: true },
      take: 6,
      orderBy: { createdAt: "desc" },
    }),
    prisma.banner.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    }),
  ]);

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Historia />
        <Destacados products={featuredProducts} />
        <Promociones banners={banners} />
        <PorQueElegirnos />
        <FidelizacionTeaser />
        <JuegosSection />
        <Resenas reviews={reviews} />
        <Galeria />
      </main>
      <Footer />
    </>
  );
}
