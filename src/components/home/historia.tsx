"use client";

import { AnimatedSection } from "@/components/animations/AnimatedSection";
import { Reveal } from "@/components/animations/Reveal";
import { Stagger } from "@/components/animations/Stagger";
import { HoverScale } from "@/components/animations/HoverScale";

const pasos = [
  {
    title: "La carne",
    text: "Molida a diario, sin conservantes, con un blend propio de cortes que le da jugosidad a cada mordida.",
  },
  {
    title: "El pan",
    text: "Horneado excelente, brioche suave por fuera y firme por dentro para aguantar cada capa de ingredientes.",
  },
  {
    title: "El fuego",
    text: "Cocinamos perfectamente para sellar el sabor y dejar ese toque ahumado que nos distingue.",
  },
];

export function Historia() {
  return (
    <AnimatedSection id="historia" className="container-lm py-24">
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <p className="eyebrow mb-3">Nuestra historia</p>
          <h2 className="font-display text-4xl leading-tight tracking-wide text-charcoal-900 dark:text-cream sm:text-5xl">
            NACIMOS DE LAS GANAS DE HACER
            <span className="text-ember-600"> LO ARTESANAL, BIEN.</span>
          </h2>
          <p className="mt-6 text-charcoal-500 dark:text-charcoal-200">
            La Mordida empezó como un carrito de barrio con una idea simple: nada de congelados, nada de atajos.
            Solo carne fresca, pan recién horneado y las manos de nuestro equipo armando cada hamburguesa y cada
            perro caliente como si fuera para su propia familia. Hoy seguimos igual, solo que con más mesas y más
            mordidas por repartir.
          </p>
        </Reveal>

        <Stagger className="space-y-4">
          {pasos.map((paso, i) => (
            <Reveal key={paso.title}>
              <HoverScale>
                <div className="flex gap-5 rounded-2xl border border-charcoal-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800">
                  <span className="font-mono text-sm text-ember-500">0{i + 1}</span>
                  <div>
                    <h3 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">
                      {paso.title}
                    </h3>
                    <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">{paso.text}</p>
                  </div>
                </div>
              </HoverScale>
            </Reveal>
          ))}
        </Stagger>
      </div>
    </AnimatedSection>
  );
}
