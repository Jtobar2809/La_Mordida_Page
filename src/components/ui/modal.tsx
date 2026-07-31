"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  // Use a div-based modal (avoid dialog.showModal due to inconsistent iOS support)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-charcoal-900/60 backdrop-blur-sm"
        aria-hidden
      />

      <div className={cn("fixed inset-0 z-50 flex items-center justify-center p-4", className)}>
        <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-charcoal-100 bg-white shadow-premium dark:border-charcoal-600 dark:bg-charcoal-800 sm:h-auto sm:max-h-[85vh] sm:w-[calc(100vw-2rem)] sm:max-w-lg">
          <div className="flex shrink-0 items-start justify-between border-b border-charcoal-100 p-5 dark:border-charcoal-700">
            <div>
              <h2 className="font-display text-lg font-bold text-charcoal-900 dark:text-cream">{title}</h2>
              {description && <p className="mt-1 text-sm text-charcoal-400">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-1.5 text-charcoal-400 transition-colors hover:bg-charcoal-100 hover:text-charcoal-800 dark:hover:bg-charcoal-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      </div>
    </>
  );
}
