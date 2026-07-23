import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MenuBrowser } from "@/components/menu/menu-browser";

export const revalidate = 30;

export const metadata = {
  title: "Menú",
  description: "Hamburguesas y perros calientes artesanales de La Mordida. Explora el menú completo y pide en línea.",
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
          <MenuBrowser categories={categories} />
        </div>
      </main>
      <Footer />
    </>
  );
}
