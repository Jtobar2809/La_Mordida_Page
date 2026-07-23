import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { CinematicHero } from "@/components/animations/CinematicHero";
import { Skeleton, ProductGridSkeleton } from "@/components/ui/Skeleton";

/**
 * Loading state de la home mientras se resuelven las queries de Prisma
 * (productos destacados, reseñas, banners). El Hero se muestra completo
 * de inmediato (es contenido estático, no depende de datos), y el resto
 * del scroll se reemplaza por skeletons para evitar el salto en blanco.
 */
export default function HomeLoading() {
  return (
    <>
      <Navbar />
      <main>
        <CinematicHero className="bg-char-gradient text-cream">
          <div className="container-lm relative flex min-h-[88vh] flex-col justify-center gap-8 py-24">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-24 w-full max-w-3xl" />
            <Skeleton className="h-6 w-full max-w-xl" />
            <div className="flex gap-4">
              <Skeleton className="h-14 w-40 rounded-full" />
              <Skeleton className="h-14 w-40 rounded-full" />
            </div>
          </div>
        </CinematicHero>

        <div className="container-lm py-24">
          <ProductGridSkeleton count={6} />
        </div>
      </main>
      <Footer />
    </>
  );
}
