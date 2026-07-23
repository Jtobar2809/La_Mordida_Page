"use client";

import Link from "next/link";
import { Flame, Star } from "lucide-react";
import { AnimatedTitle } from "@/components/ui/AnimatedTitle";
import { GlowButton } from "@/components/ui/GlowButton";
import { Button } from "@/components/ui/button";
import { CinematicHero } from "@/components/animations/CinematicHero";
import { Reveal } from "@/components/animations/Reveal";
import { Stagger } from "@/components/animations/Stagger";

export function Hero() {
  return (
    <CinematicHero className="bg-char-gradient text-cream">
      <div className="container-lm relative flex min-h-[88vh] flex-col justify-center gap-8 py-24">
        <Reveal>
          <span className="eyebrow">100% artesanal · carnes y pan hechos en casa</span>
        </Reveal>

        <AnimatedTitle
          as="h1"
          className="max-w-3xl text-6xl leading-[0.95] sm:text-8xl"
        >
          NO SE COME. SE MUERDE.
        </AnimatedTitle>

        <Reveal>
          <p className="max-w-xl text-lg text-charcoal-100">
            Hamburguesas y perros calientes artesanales, con carnes molidas en casa e ingredientes frescos todos los
            días. Cada mordida suma puntos para tus próximos antojos.
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

        <Reveal className="mt-6 flex flex-wrap items-center gap-6 text-sm text-charcoal-200">
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
    </CinematicHero>
  );
}
