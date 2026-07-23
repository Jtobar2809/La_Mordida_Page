import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Bloque base de skeleton con shimmer animado (gradiente que se desliza).
 * Componer con className para el tamaño/forma deseada (h-4 w-full, etc).
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-charcoal-100 dark:bg-charcoal-700",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent",
        "dark:before:via-white/10",
        className
      )}
    />
  );
}

/** Skeleton de una card de producto (imagen + título + descripción + precio) */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-6">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Grid de skeletons de producto — para pantallas de carga del menú */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Línea de texto skeleton — para reemplazar párrafos mientras cargan */
export function TextLineSkeleton({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-4 w-full", className)} />;
}
