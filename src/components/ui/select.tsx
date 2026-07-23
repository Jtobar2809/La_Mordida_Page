import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-charcoal-200 bg-white px-4 pr-10 text-sm text-charcoal-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:border-ember-500 dark:bg-charcoal-800 dark:border-charcoal-600 dark:text-cream",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
    </div>
  )
);
Select.displayName = "Select";
