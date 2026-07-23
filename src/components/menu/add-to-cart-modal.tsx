"use client";

import * as React from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCart } from "@/hooks/use-cart";
import { formatCOP, cn } from "@/lib/utils";
import type { ProductWithExtras } from "@/types/menu";

export function AddToCartModal({ product, onClose }: { product: ProductWithExtras | null; onClose: () => void }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = React.useState(1);
  const [selectedExtras, setSelectedExtras] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (product) {
      setQuantity(1);
      setSelectedExtras([]);
      setNotes("");
    }
  }, [product]);

  if (!product) return null;

  const extrasTotal = product.extras
    .filter((e) => selectedExtras.includes(e.id))
    .reduce((sum, e) => sum + e.price, 0);
  const total = (product.price + extrasTotal) * quantity;

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const handleAdd = () => {
    addItem({
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      quantity,
      notes: notes.trim() || undefined,
      extras: product.extras
        .filter((e) => selectedExtras.includes(e.id))
        .map((e) => ({ id: e.id, name: e.name, price: e.price })),
    });
    toast.success(`${product.name} agregado al carrito`);
    onClose();
  };

  return (
    <Modal open={!!product} onClose={onClose} title={product.name} description={product.description}>
      <div className="space-y-6">
        {product.ingredients.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Ingredientes</p>
            <div className="flex flex-wrap gap-1.5">
              {product.ingredients.map((ing) => (
                <span key={ing} className="rounded-full bg-charcoal-100 px-2.5 py-1 text-xs text-charcoal-600 dark:bg-charcoal-700 dark:text-charcoal-200">
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}

        {product.extras.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Extras</p>
            <div className="space-y-2">
              {product.extras.map((extra) => (
                <label
                  key={extra.id}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors",
                    selectedExtras.includes(extra.id)
                      ? "border-ember-500 bg-ember-50 dark:bg-ember-900/20"
                      : "border-charcoal-200 dark:border-charcoal-600"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedExtras.includes(extra.id)}
                      onChange={() => toggleExtra(extra.id)}
                      className="h-4 w-4 accent-ember-600"
                    />
                    {extra.name}
                  </span>
                  <span className="text-charcoal-400">{extra.price > 0 ? `+${formatCOP(extra.price)}` : "Gratis"}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="notes">Instrucciones especiales (opcional)</Label>
          <Textarea
            id="notes"
            placeholder="Ej: sin cebolla, término medio..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 rounded-full border border-charcoal-200 px-2 py-1 dark:border-charcoal-600">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-charcoal-100 dark:hover:bg-charcoal-700"
              aria-label="Restar cantidad"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center font-semibold">{quantity}</span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-charcoal-100 dark:hover:bg-charcoal-700"
              aria-label="Sumar cantidad"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={handleAdd} size="lg">
            Agregar · {formatCOP(total)}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
