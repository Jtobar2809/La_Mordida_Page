"use client";

import Image from "next/image"; // kept for potential revert — using native <img> for a quick load test below
import { AnimatedSection } from "@/components/animations/AnimatedSection";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Reveal } from "@/components/animations/Reveal";
import { Stagger } from "@/components/animations/Stagger";
import { HoverScale } from "@/components/animations/HoverScale";

export function Galeria({ images }: { images: { id?: string; image: string; alt?: string; order?: number }[] }) {
  if (!images || images.length === 0) return null;

  return (
    <AnimatedSection className="bg-charcoal-50 py-24 dark:bg-charcoal-800/40">
      <div className="container-lm">
        <SectionTitle eyebrow="Galería" title="ASÍ SE VE UNA MORDIDA" />

        <Stagger className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4 md:grid-rows-2">
          {images.map((img, idx) => (
            <Reveal
              key={img.id ?? img.alt ?? idx}
              className={
                idx === 0
                  ? "col-span-2 row-span-1 aspect-video md:row-span-2 md:aspect-auto"
                  : "aspect-square"
              }
            >
              <HoverScale>
                <div className="relative h-full w-full overflow-hidden rounded-2xl">
                  {/* Quick test: use native img to bypass Next.js image behavior */}
                  <img
                    src={img.image}
                    alt={img.alt ?? "Hamburguesa artesanal La Mordida en Popayán"}
                    className="object-cover block w-full h-full transition-transform duration-500 hover:scale-110"
                    loading="lazy"
                    onError={(e) => {
                      // show placeholder and log which URL failed so user can inspect in DevTools
                      // eslint-disable-next-line no-console
                      console.warn("Galería: imagen falló al cargar:", img.image, img.alt);
                      const placeholder = "data:image/svg+xml;utf8," +
                        encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'><rect width='100%' height='100%' fill='%23e5e7eb'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%236b7280' font-family='Arial,Helvetica,sans-serif' font-size='32'>Imagen no disponible</text></svg>");
                      (e.currentTarget as HTMLImageElement).src = placeholder;
                    }}
                  />
                </div>
              </HoverScale>
            </Reveal>
          ))}
        </Stagger>
      </div>
    </AnimatedSection>
  );
}
