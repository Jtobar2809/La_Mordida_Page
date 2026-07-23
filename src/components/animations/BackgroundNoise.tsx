import { cn } from "@/lib/utils";

interface BackgroundNoiseProps {
  className?: string;
  opacity?: number;
}

/**
 * Textura de grano/ruido sutil superpuesta sobre fondos sólidos o
 * gradientes, para quitar el aspecto "plano" digital (técnica común
 * en Linear/Raycast). Generado con SVG feTurbulence inline — sin
 * depender de ningún asset de imagen externo.
 */
export function BackgroundNoise({ className, opacity = 0.045 }: BackgroundNoiseProps) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 mix-blend-overlay", className)}
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}
