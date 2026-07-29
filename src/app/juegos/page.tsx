import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import GamesHubClient from "@/components/GamesHubClient";

export const metadata = {
  title: "Juegos",
  description: "Minijuegos rápidos con Mordi. Compite en la tabla de posiciones de La Mordida.",
};

export default function JuegosPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="bg-char-gradient py-16 text-cream">
          <div className="container-lm">
            <p className="eyebrow mb-3">Zona de juegos</p>
            <h1 className="font-display text-5xl tracking-wide sm:text-6xl">JUEGA CON MORDI</h1>
            <p className="mt-3 max-w-xl text-charcoal-100">
              Minijuegos rápidos, solo por diversión. Compite en la tabla de posiciones y demuestra quién es el más
              rápido.
            </p>
          </div>
        </div>
        <div className="container-lm py-16">
          <GamesHubClient />
        </div>
      </main>
      <Footer />
    </>
  );
}
