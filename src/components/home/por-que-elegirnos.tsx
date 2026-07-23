import { Beef, Leaf, Timer, Gift } from "lucide-react";

const items = [
  {
    icon: Beef,
    title: "Carne 100% fresca",
    text: "Molida a diario, sin conservantes ni rellenos raros.",
  },
  {
    icon: Leaf,
    title: "Ingredientes naturales",
    text: "Vegetales frescos y salsas hechas en casa cada mañana.",
  },
  {
    icon: Timer,
    title: "Preparación artesanal",
    text: "Nada de microondas: cada pedido se arma al momento.",
  },
  {
    icon: Gift,
    title: "Puntos en cada compra",
    text: "Acumula, sube de nivel y canjea recompensas reales.",
  },
];

export function PorQueElegirnos() {
  return (
    <section className="bg-charcoal-50 py-24 dark:bg-charcoal-800/40">
      <div className="container-lm">
        <p className="eyebrow mb-3 text-center">Por qué elegirnos</p>
        <h2 className="mx-auto max-w-2xl text-center font-display text-4xl leading-tight tracking-wide text-charcoal-900 dark:text-cream sm:text-5xl">
          CUATRO RAZONES PARA VOLVER A MORDER
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="group rounded-2xl border border-charcoal-100 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ember-300 hover:shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ember-gradient text-white transition-transform group-hover:scale-110">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">{title}</h3>
              <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
