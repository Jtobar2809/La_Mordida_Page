import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "ember",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  accent?: "ember" | "olive" | "mustard";
}) {
  const accentBg = {
    ember: "bg-ember-gradient",
    olive: "bg-olive-500",
    mustard: "bg-mustard-400",
  }[accent];

  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-white", accentBg)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-3xl text-charcoal-900 dark:text-cream">{value}</p>
      {trend && <p className="mt-1 text-xs text-olive-600">{trend}</p>}
    </div>
  );
}
