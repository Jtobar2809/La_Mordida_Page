"use client";

import Link from "next/link";
import Image from "next/image";
import { Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";
import { AnimatedSection } from "@/components/animations/AnimatedSection";
import { Reveal } from "@/components/animations/Reveal";
import { Stagger } from "@/components/animations/Stagger";
import { Card3D } from "@/components/animations/Card3D";

type FeaturedProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  spicyLevel: number;
};

export function Destacados({ products }: { products: FeaturedProduct[] }) {
  if (products.length === 0) return null;

  return (
    <AnimatedSection className="container-lm py-24">
      <Reveal className="mb-14 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-3">Especialidades</p>
          <h2 className="font-display text-4xl leading-tight tracking-wide text-charcoal-900 dark:text-cream sm:text-5xl">
            LO MÁS PEDIDO DE LA CASA
          </h2>
        </div>
        <Link href="/menu">
          <Button variant="outline">Ver todo el menú</Button>
        </Link>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Reveal key={product.id}>
            <Card3D intensity={6}>
              <Card bite className="group overflow-hidden !p-0">
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
                  <div className="absolute left-3 top-3 flex gap-2">
                    <Badge variant="ember">Destacado</Badge>
                    {product.spicyLevel > 0 && <Badge variant="charcoal">🌶️ {product.spicyLevel}/3</Badge>}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">
                    {product.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-charcoal-500 dark:text-charcoal-300">
                    {product.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-ember-600">{formatCOP(product.price)}</span>
                    <Link href={`/menu?producto=${product.slug}`}>
                      <Button size="sm">Agregar</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </Card3D>
          </Reveal>
        ))}
      </Stagger>
    </AnimatedSection>
  );
}
