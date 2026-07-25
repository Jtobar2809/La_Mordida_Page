import { GamesHub } from "@/components/games/GamesHub";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { AnimatedSection } from "@/components/animations/AnimatedSection";

/**
 * Sección de minijuegos del Home. Siempre visible — los minijuegos son
 * puramente recreativos (no otorgan puntos de fidelización), pensados
 * para diversión y engagement de comunidad vía tabla de posiciones.
 */
export function JuegosSection() {
  return (
    <AnimatedSection className="bg-charcoal-50 py-24 dark:bg-charcoal-800/40">
      <div className="container-lm">
        <SectionTitle
          eyebrow="Zona de juegos"
          title="JUEGA CON MORDI"
          description="Minijuegos rápidos, solo por diversión. Compite en la tabla de posiciones y demuestra quién es el más rápido."
        />
        <div className="mt-12">
          <GamesHub />
        </div>
      </div>
    </AnimatedSection>
  );
}
