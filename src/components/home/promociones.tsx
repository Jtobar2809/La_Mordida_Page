"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatedSection } from "@/components/animations/AnimatedSection";
import { Reveal } from "@/components/animations/Reveal";
import { Stagger } from "@/components/animations/Stagger";
import { HoverScale } from "@/components/animations/HoverScale";

type BannerItem = {
  id: string;
  title: string;
  subtitle: string | null;
  image: string;
  link: string | null;
};

export function Promociones({ banners }: { banners: BannerItem[] }) {
  if (banners.length === 0) return null;

  return (
    <AnimatedSection className="container-lm py-16">
      <Reveal>
        <p className="eyebrow mb-3">Promociones</p>
        <h2 className="mb-8 font-display text-4xl leading-tight tracking-wide text-charcoal-900 dark:text-cream sm:text-5xl">
          OFERTAS DEL MOMENTO
        </h2>
      </Reveal>

      <Stagger className="flex snap-x gap-5 overflow-x-auto pb-2">
        {banners.map((banner) => {
          const content = (
            <HoverScale>
              <div className="group relative h-64 w-[85vw] shrink-0 snap-start overflow-hidden rounded-2xl sm:w-[420px]">
                <Image
                  src={banner.image}
                  alt={banner.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 640px) 85vw, 420px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-cream">
                  <p className="font-display text-2xl tracking-wide">{banner.title}</p>
                  {banner.subtitle && <p className="mt-1 text-sm text-charcoal-100">{banner.subtitle}</p>}
                </div>
              </div>
            </HoverScale>
          );

          return (
            <Reveal key={banner.id} className="shrink-0">
              {banner.link ? <Link href={banner.link}>{content}</Link> : content}
            </Reveal>
          );
        })}
      </Stagger>
    </AnimatedSection>
  );
}
