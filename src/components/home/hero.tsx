import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame, Star } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-char-gradient text-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-ember-600/30 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-mustard-500/20 blur-[100px]"
      />

      <div className="container-lm relative flex min-h-[88vh] flex-col justify-center gap-8 py-24">
        <div className="animate-fade-up flex items-center gap-2">
          <span className="eyebrow">100% artesanal · carnes y pan hechos en casa</span>
        </div>

        <h1 className="animate-fade-up max-w-3xl font-display text-6xl leading-[0.95] tracking-wide sm:text-8xl">
          NO SE COME.
          <br />
          <span className="text-ember-500">SE MUERDE.</span>
        </h1>

        <p className="animate-fade-up max-w-xl text-lg text-charcoal-100" style={{ animationDelay: "0.1s" }}>
          Hamburguesas y perros calientes artesanales, con carnes molidas en casa e ingredientes frescos todos los
          días. Cada mordida suma puntos para tus próximos antojos.
        </p>

        <div className="animate-fade-up flex flex-wrap items-center gap-4" style={{ animationDelay: "0.2s" }}>
          <Link href="/menu">
            <Button size="lg" className="group">
              <Flame className="h-5 w-5 transition-transform group-hover:scale-125" />
              Pedir ahora
            </Button>
          </Link>
          <Link href="/#historia">
            <Button size="lg" variant="secondary">
              Conoce la marca
            </Button>
          </Link>
        </div>

        <div className="animate-fade-up mt-6 flex flex-wrap items-center gap-6 text-sm text-charcoal-200" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-1.5">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-mustard-400 text-mustard-400" />
              ))}
            </div>
            <span>+2.400 mordidas felices</span>
          </div>
          <div className="hidden h-4 w-px bg-charcoal-600 sm:block" />
          <span>Puntos, niveles y recompensas en cada pedido</span>
        </div>
      </div>
    </section>
  );
}
