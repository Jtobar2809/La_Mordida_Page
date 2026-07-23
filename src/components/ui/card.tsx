import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — con la esquina "mordida" como firma visual de la marca.
 * Usa un mask-image radial para recortar un círculo de la esquina superior derecha,
 * como si alguien le hubiera dado un mordisco. Se activa con la prop `bite`.
 */
export function Card({
  className,
  bite = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { bite?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-charcoal-100 bg-white/90 dark:bg-charcoal-800/80 dark:border-charcoal-600 shadow-premium backdrop-blur-sm transition-all duration-300",
        bite && "card-bite",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-xl font-bold text-charcoal-900 dark:text-cream", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-charcoal-400 dark:text-charcoal-200", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
