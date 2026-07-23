"use client";

import { Star } from "lucide-react";
import { AnimatedSection } from "@/components/animations/AnimatedSection";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Reveal } from "@/components/animations/Reveal";
import { Stagger } from "@/components/animations/Stagger";
import { HoverScale } from "@/components/animations/HoverScale";

type ReviewItem = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  avatar: string | null;
};

export function Resenas({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) return null;

  return (
    <AnimatedSection className="container-lm py-24">
      <SectionTitle eyebrow="Lo que dicen" title="MORDIDAS QUE DEJAN HUELLA" />

      <Stagger className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {reviews.slice(0, 6).map((review) => (
          <Reveal key={review.id}>
            <HoverScale>
              <div className="rounded-2xl border border-charcoal-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < review.rating ? "fill-mustard-400 text-mustard-400" : "text-charcoal-200"}`}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-charcoal-600 dark:text-charcoal-200">&ldquo;{review.comment}&rdquo;</p>
                <p className="mt-4 text-sm font-semibold text-charcoal-900 dark:text-cream">{review.authorName}</p>
              </div>
            </HoverScale>
          </Reveal>
        ))}
      </Stagger>
    </AnimatedSection>
  );
}
