import { prisma } from "@/lib/prisma";
import { GaleriaManager } from "@/components/admin/galeria-manager";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const revalidate = 0;

export default async function AdminGaleriaPage() {
  const images = await prisma.galleryImage.findMany({ orderBy: { order: "asc" } });

  return (
    <>
      <Navbar />
      <main className="container-lm py-12">
        <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">GALERÍA</h1>
        <p className="mb-6 text-sm text-charcoal-500">Administra las imágenes que se muestran en la sección “ASÍ SE VE UNA MORDIDA”.</p>
        <GaleriaManager images={images} />
      </main>
      <Footer />
    </>
  );
}
