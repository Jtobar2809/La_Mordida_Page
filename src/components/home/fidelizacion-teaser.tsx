import Link from "next/link";
import { Flame, Gem, Award, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";

const niveles = [
  { name: "Bronce", icon: Medal, color: "text-amber-700", desc: "Empiezas aquí" },
  { name: "Plata", icon: Award, color: "text-slate-400", desc: "Descuentos exclusivos" },
  { name: "Oro", icon: Flame, color: "text-mustard-400", desc: "Regalos de cumpleaños" },
  { name: "Diamante", icon: Gem, color: "text-sky-300", desc: "Beneficios VIP" },
];

export function FidelizacionTeaser() {
  return (
    <section className="relative overflow-hidden bg-char-gradient py-24 text-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-ember-600/20 blur-[100px]"
      />
      <div className="container-lm relative">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow mb-3">Programa de fidelización</p>
            <h2 className="font-display text-4xl leading-tight tracking-wide sm:text-5xl">
              CADA MORDIDA
              <br />
              <span className="text-ember-500">SUMA PUNTOS.</span>
            </h2>
            <p className="mt-6 max-w-md text-charcoal-200">
              Regístrate, pide y acumula puntos con cada compra. Sube de nivel, completa desafíos y canjéalos por
              hamburguesas, papas, bebidas y premios especiales.
            </p>
            <Link href="/registro">
              <Button size="lg" className="mt-8">
                Únete gratis
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {niveles.map(({ name, icon: Icon, color, desc }) => (
              <div
                key={name}
                className="rounded-2xl border border-charcoal-600 bg-charcoal-800/60 p-5 backdrop-blur-sm transition-transform hover:-translate-y-1"
              >
                <Icon className={`h-8 w-8 ${color}`} />
                <p className="mt-3 font-display text-2xl tracking-wide">{name}</p>
                <p className="text-sm text-charcoal-300">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
