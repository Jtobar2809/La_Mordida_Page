"use client";

import Link from "next/link";
import { Stamp, Gift, QrCode, Sparkles } from "lucide-react";
import { AnimatedSection } from "@/components/animations/AnimatedSection";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { GlowButton } from "@/components/ui/GlowButton";
import { Reveal } from "@/components/animations/Reveal";
import { Stagger } from "@/components/animations/Stagger";
import { HoverScale } from "@/components/animations/HoverScale";
import { Floating } from "@/components/animations/Floating";

const pasos = [
  { name: "Compra", icon: QrCode, color: "text-mustard-400", desc: "Pide en caja y recibe tu código QR" },
  { name: "Escanea", icon: Stamp, color: "text-ember-400", desc: "Suma un sello a tu tarjeta" },
  { name: "Repite", icon: Sparkles, color: "text-sky-300", desc: "Junta 7 sellos en total" },
  { name: "Disfruta", icon: Gift, color: "text-amber-400", desc: "Una hamburguesa gratis te espera" },
];

export function FidelizacionTeaser() {
  return (
    <AnimatedSection className="relative overflow-hidden bg-char-gradient py-24 text-cream">
      <GradientBackground variant="char" />

      <div className="container-lm relative">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow mb-3">Tarjeta de sellos</p>
            <h2 className="font-display text-4xl leading-tight tracking-wide sm:text-5xl">
              CADA MORDIDA
              <br />
              <span className="text-ember-500">SUMA UN SELLO.</span>
            </h2>
            <p className="mt-6 max-w-md text-charcoal-200">
              Regístrate, pide en caja y escanea tu código QR después de cada compra. Junta 7 sellos y te regalamos
              una hamburguesa gratis.
            </p>
            <Link href="/registro">
              <GlowButton className="mt-8">Únete gratis</GlowButton>
            </Link>
          </Reveal>

          <Stagger className="grid grid-cols-2 gap-4">
            {pasos.map(({ name, icon: Icon, color, desc }) => (
              <Reveal key={name}>
                <HoverScale>
                  <Floating>
                    <div className="rounded-2xl border border-charcoal-600 bg-charcoal-800/60 p-5 backdrop-blur-sm">
                      <Icon className={`h-8 w-8 ${color}`} />
                      <p className="mt-3 font-display text-2xl tracking-wide">{name}</p>
                      <p className="text-sm text-charcoal-300">{desc}</p>
                    </div>
                  </Floating>
                </HoverScale>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </div>
    </AnimatedSection>
  );
}
