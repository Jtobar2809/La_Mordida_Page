import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal-800 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-ember-gradient text-white shadow-glow hover:shadow-[0_0_50px_-6px_rgba(232,92,43,0.75)] hover:-translate-y-0.5",
        secondary:
          "bg-charcoal-800 text-cream border border-charcoal-600 hover:border-ember-500 hover:bg-charcoal-700",
        outline:
          "border-2 border-charcoal-800 text-charcoal-800 hover:bg-charcoal-800 hover:text-cream dark:border-cream dark:text-cream dark:hover:bg-cream dark:hover:text-charcoal-900",
        ghost: "text-charcoal-700 hover:bg-charcoal-100 dark:text-cream dark:hover:bg-charcoal-700/50",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        link: "text-ember-600 underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
