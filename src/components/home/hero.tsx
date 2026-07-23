"use client";

import Link from "next/link";
import Image from "next/image";
import { Flame, Star } from "lucide-react";
import { AnimatedTitle } from "@/components/ui/AnimatedTitle";
import { GlowButton } from "@/components/ui/GlowButton";
import { Button } from "@/components/ui/button";
import { CinematicHero } from "@/components/animations/CinematicHero";
import { Reveal } from "@/components/animations/Reveal";
import { Stagger } from "@/components/animations/Stagger";
import { Floating } from "@/components/animations/Floating";
import { MouseParallax } from "@/components/animations/MouseParallax";

export function Hero() {
  return (
    <CinematicHero className="bg-char-gradient text-cream">
      <div className="container-lm relative -mt-[76px] grid min-h-[88vh] grid-cols-1 items-center gap-4 py-24 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
        {/* Columna de texto */}
        <div className="relative z-10 flex flex-col gap-8">
          <Reveal>
            <span className="eyebrow">100% artesanal · carnes y pan hechos en casa</span>
          </Reveal>

          <AnimatedTitle
            as="h1"
            className="max-w-3xl text-6xl leading-[0.95] sm:text-8xl lg:text-7xl xl:text-8xl"
          >
            NO SE COME. SE MUERDE.
          </AnimatedTitle>

          <Reveal>
            <p className="max-w-xl text-lg text-charcoal-100">
              Hamburguesas y perros calientes artesanales, con carnes molidas en casa e ingredientes frescos todos
              los días. Cada mordida suma puntos para tus próximos antojos.
            </p>
          </Reveal>

          <Stagger className="flex flex-wrap items-center gap-4">
            <Reveal>
              <Link href="/menu">
                <GlowButton className="inline-flex items-center gap-2 text-base">
                  <Flame className="h-5 w-5" />
                  Pedir ahora
                </GlowButton>
              </Link>
            </Reveal>
            <Reveal>
              <Link href="/#historia">
                <Button size="lg" variant="secondary">
                  Conoce la marca
                </Button>
              </Link>
            </Reveal>
          </Stagger>

          <Reveal className="mt-2 flex flex-wrap items-center gap-6 text-sm text-charcoal-200">
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
          </Reveal>
        </div>

        {/* Mascota — decorativa detrás del texto en mobile, columna propia en desktop */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center opacity-[0.14] lg:pointer-events-auto lg:relative lg:z-10 lg:opacity-100 lg:justify-self-end"
        >
          <MouseParallax strength={16} className="hidden lg:block">
            <Floating distance={14} duration={5}>
              <Image
                src="/MordiSinFondo.png"
                alt="Mordi, la mascota de La Mordida"
                width={520}
                height={520}
                priority
                className="w-[260px] drop-shadow-[0_25px_45px_rgba(0,0,0,0.45)] sm:w-[340px] lg:w-[420px] xl:w-[480px]"
              />
            </Floating>
          </MouseParallax>

          {/* Versión mobile: sin parallax de mouse (no aplica en touch), solo flotación e integrada como fondo suave */}
          <div className="lg:hidden">
            <Floating distance={10} duration={4.5}>
              <Image
                src="/MordiSinFondo.png"
                alt=""
                width={520}
                height={520}
                className="w-[280px] sm:w-[360px]"
              />
            </Floating>
          </div>
        </div>
      </div>
    </CinematicHero>
  );
}
