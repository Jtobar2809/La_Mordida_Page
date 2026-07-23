import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Loading state automático de Next.js para /menu mientras se resuelven
 * las queries de Prisma (categorías + productos). Replica el header
 * estático de la página real para que no haya salto de layout al
 * terminar de cargar.
 */
export default function MenuLoading() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="bg-char-gradient py-16 text-cream">
          <div className="container-lm">
            <p className="eyebrow mb-3">El menú completo</p>
            <h1 className="font-display text-5xl tracking-wide sm:text-6xl">HAZ TU PEDIDO</h1>
          </div>
        </div>
        <div className="container-lm py-12">
          <div className="mb-8 flex gap-3">
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
          <ProductGridSkeleton count={6} />
        </div>
      </main>
      <Footer />
    </>
  );
}
