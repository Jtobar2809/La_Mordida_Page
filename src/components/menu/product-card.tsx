import Image from "next/image";
import { Flame, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCOP } from "@/lib/utils";
import type { ProductWithExtras } from "@/types/menu";

export function ProductCard({ product, onSelect }: { product: ProductWithExtras; onSelect: () => void }) {
  return (
    <Card className="group flex flex-col overflow-hidden !p-0 transition-all hover:-translate-y-1">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-charcoal-100">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-charcoal-200">
            <Flame className="h-10 w-10" />
          </div>
        )}
        {product.spicyLevel > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-charcoal-900/80 px-2.5 py-1 text-xs font-semibold text-white">
            🌶️ {product.spicyLevel}/3
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">{product.name}</h3>
        <p className="mt-1 line-clamp-2 flex-1 text-sm text-charcoal-500 dark:text-charcoal-300">{product.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-lg font-bold text-ember-600">{formatCOP(product.price)}</span>
          <button
            onClick={onSelect}
            aria-label={`Agregar ${product.name} al carrito`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-gradient text-white shadow-glow transition-transform hover:scale-110 active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
