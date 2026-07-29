import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/home/hero";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { Historia } from "@/components/home/historia";
import { Destacados } from "@/components/home/destacados";
import { Promociones } from "@/components/home/promociones";
import { PorQueElegirnos } from "@/components/home/por-que-elegirnos";
import { FidelizacionTeaser } from "@/components/home/fidelizacion-teaser";
import { Resenas } from "@/components/home/resenas";
import { Galeria } from "@/components/home/galeria";

export const revalidate = 60;

export default async function HomePage() {
  const [featuredProducts, reviews, heroBanners, promoBanners, galleryImages] = await Promise.all([
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
      where: { active: true, placement: "HERO" },
      orderBy: { order: "asc" },
    }),
    prisma.banner.findMany({
      where: { active: true, placement: "PROMOCIONES" },
      orderBy: { order: "asc" },
    }),
    prisma.galleryImage.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const galleryImagesClean = galleryImages.map((g) => ({
    id: g.id,
    image: g.image,
    alt: g.alt ?? undefined,
    order: g.order,
  }));

  return (
    <>
      <Navbar />
      <main>
        <HeroCarousel banners={heroBanners.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, image: b.image, link: b.link }))} />
        <Hero />
        <Historia />
        <Destacados products={featuredProducts} />
        <Promociones banners={promoBanners.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, image: b.image, link: b.link }))} />
        <PorQueElegirnos />
        <FidelizacionTeaser />
        <Resenas reviews={reviews} />
        <Galeria images={galleryImagesClean} />
      </main>
      <Footer />
    </>
  );
}
