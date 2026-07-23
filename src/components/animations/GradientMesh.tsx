import { cn } from "@/lib/utils";

interface GradientMeshProps {
  className?: string;
}

/**
 * Malla de gradientes radiales superpuestos (mesh gradient) — capa
 * estática de color más rica que GradientBackground (que anima 2 blobs).
 * Útil como fondo base antes de apilar GradientBackground/FloatingLights
 * encima para profundidad extra. El padre debe tener position: relative.
 */
export function GradientMesh({ className }: GradientMeshProps) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-20", className)}
      style={{
        backgroundImage: `
          radial-gradient(at 15% 20%, rgba(232,92,43,0.25) 0px, transparent 55%),
          radial-gradient(at 85% 15%, rgba(240,169,58,0.22) 0px, transparent 50%),
          radial-gradient(at 75% 80%, rgba(232,92,43,0.18) 0px, transparent 50%),
          radial-gradient(at 20% 85%, rgba(74,90,52,0.15) 0px, transparent 50%)
        `,
      }}
    />
  );
}
