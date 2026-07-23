"use client";

import { Reveal } from "@/components/animations/Reveal";
import { cn } from "@/lib/utils";

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

/**
 * Encabezado estándar de sección (eyebrow + título + descripción),
 * reutilizable en Menú, Recompensas, Testimonios, etc. Envuelve el
 * bloque completo en Reveal para consistencia con el resto del sistema.
 */
export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionTitleProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="font-display text-4xl tracking-wide text-charcoal-900 dark:text-cream sm:text-5xl">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "text-charcoal-500 dark:text-charcoal-200",
            align === "center" ? "max-w-2xl" : "max-w-xl"
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
