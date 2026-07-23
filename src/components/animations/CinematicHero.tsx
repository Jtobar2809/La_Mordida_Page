"use client";

import { cn } from "@/lib/utils";
import { GradientMesh } from "@/components/animations/GradientMesh";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { FloatingLights } from "@/components/animations/FloatingLights";
import { BackgroundNoise } from "@/components/animations/BackgroundNoise";

interface CinematicHeroProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Compositor de capas para un hero cinematográfico: mesh gradient (base) +
 * blobs animados + luces flotantes + grano de textura, apiladas en el
 * orden correcto con los z-index ya resueltos. El contenido (children)
 * se renderiza encima de todas las capas. Usar en vez de armar las 4
 * capas a mano cada vez.
 */
export function CinematicHero({ children, className }: CinematicHeroProps) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <GradientMesh />
      <GradientBackground variant="char" />
      <FloatingLights />
      <BackgroundNoise />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
