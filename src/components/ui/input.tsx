import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-charcoal-200 bg-white px-4 text-sm text-charcoal-900 placeholder:text-charcoal-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:border-ember-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-charcoal-800 dark:border-charcoal-600 dark:text-cream dark:placeholder:text-charcoal-400",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
