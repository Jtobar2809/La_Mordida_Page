import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        ember: "bg-ember-100 text-ember-700 dark:bg-ember-900/40 dark:text-ember-300",
        mustard: "bg-mustard-100 text-mustard-800 dark:bg-mustard-900/40 dark:text-mustard-300",
        olive: "bg-olive-100 text-olive-700 dark:bg-olive-900/40 dark:text-olive-300",
        charcoal: "bg-charcoal-100 text-charcoal-700 dark:bg-charcoal-700 dark:text-charcoal-100",
        outline: "border border-current text-current",
      },
    },
    defaultVariants: { variant: "ember" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
