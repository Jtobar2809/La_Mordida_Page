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
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100vw-2rem)] max-w-lg rounded-2xl border border-charcoal-100 bg-white p-0 shadow-premium backdrop:bg-charcoal-900/60 backdrop:backdrop-blur-sm dark:border-charcoal-600 dark:bg-charcoal-800",
        className
      )}
    >
      <div className="flex items-start justify-between border-b border-charcoal-100 p-5 dark:border-charcoal-700">
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
      <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}
