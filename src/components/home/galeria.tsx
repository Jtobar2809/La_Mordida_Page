"use client";

import Image from "next/image";
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
              className={idx === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-auto" : "aspect-square"}
            >
              <HoverScale>
                <div className="relative h-full w-full overflow-hidden rounded-2xl">
                  <Image
                    src={img.image}
                    alt={img.alt ?? "Galería"}
                    fill
                    className="object-cover transition-transform duration-500 hover:scale-110"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    unoptimized
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
