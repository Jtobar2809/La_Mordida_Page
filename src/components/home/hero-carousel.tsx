"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { MordiSprite } from "@/components/games/MordiSprite";

type HeroBannerItem = {
  id: string;
  title: string;
  subtitle: string | null;
  image: string;
  link: string | null;
};

const AUTOPLAY_MS = 5500;

/**
 * Carrusel de imágenes que vive entre el Navbar y el Hero principal.
 * Los banners con placement="HERO" se administran desde /admin/banners
 * (mismo modelo que las Promociones, solo con otra ubicación). Si el
 * admin no ha cargado ninguno todavía, se muestra una diapositiva de
 * respaldo ilustrada (gradiente de marca + Mordi en SVG, sin depender
 * de ninguna foto) para que la franja nunca se vea vacía ni con una
 * imagen fuera de proporción en un sitio recién desplegado.
 */
export function HeroCarousel({ banners }: { banners: HeroBannerItem[] }) {
  const hasRealBanners = banners.length > 0;
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const goTo = React.useCallback(
    (next: number) => {
      setIndex((next + banners.length) % banners.length);
    },
    [banners.length]
  );

  React.useEffect(() => {
    if (paused || !hasRealBanners || banners.length <= 1) return;
    const timer = setInterval(() => goTo(index + 1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [index, paused, hasRealBanners, banners.length, goTo]);

  if (!hasRealBanners) {
    return <FallbackSlide />;
  }

  const current = banners[index];
  if (!current) return null;

  const slideContent = (
    <div className="relative h-full w-full flex items-center justify-center bg-charcoal-900/5">
      <Image
        src={current.image}
        alt={current.title}
        fill
        priority={index === 0}
        className="object-fill w-full h-full"
        style={{ objectPosition: "center" }}
        sizes="100vw"
        unoptimized
      />
      {/* Softer gradient para no ocultar completamente imágenes horizontales */}
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/60 via-charcoal-900/15 to-charcoal-900/6" />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
        <p className="font-display text-2xl tracking-wide text-cream sm:text-4xl">{current.title}</p>
        {current.subtitle && <p className="mt-1 max-w-lg text-sm text-charcoal-100 sm:text-base">{current.subtitle}</p>}
      </div>
    </div>
  );

  return (
    <section
      className="relative h-[34vh] sm:h-[42vh] w-full min-h-[270px] max-h-[510px] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Novedades y promociones"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {current.link ? (
            <Link href={current.link} className="block h-full w-full">
              {slideContent}
            </Link>
          ) : (
            slideContent
          )}
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal-900/40 text-cream backdrop-blur-sm transition-colors hover:bg-charcoal-900/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal-900/40 text-cream backdrop-blur-sm transition-colors hover:bg-charcoal-900/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                onClick={() => goTo(i)}
                aria-label={`Ir a la diapositiva ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-6 bg-cream" : "w-1.5 bg-cream/50"
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Diapositiva de respaldo cuando el admin no ha cargado ningún banner de Hero todavía — sin dependencia de fotos */
function FallbackSlide() {
  return (
    <section className="relative flex h-[38vh] min-h-[240px] max-h-[380px] w-full items-center overflow-hidden bg-char-gradient">
      <div className="pointer-events-none absolute -right-10 top-1/2 h-64 w-64 -translate-y-1/2 opacity-20 sm:opacity-40">
        <MordiSprite expression="happy" animate={false} className="h-full w-full" />
      </div>
      <div className="container-lm relative z-10 flex flex-col gap-2">
        <span className="eyebrow inline-flex w-fit items-center gap-1.5 text-cream">
          <Flame className="h-3.5 w-3.5" /> 100% artesanal
        </span>
        <p className="font-display text-2xl tracking-wide text-cream sm:text-4xl">Carnes molidas en casa, todos los días</p>
      </div>
    </section>
  );
}
