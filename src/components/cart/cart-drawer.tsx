"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, Trash2, X, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, updateQuantity, removeItem, subtotal } = useCart();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-charcoal-900/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-cream dark:bg-charcoal-900"
          >
            <div className="flex items-center justify-between border-b border-charcoal-100 p-5 dark:border-charcoal-700">
              <h2 className="font-display text-2xl">TU PEDIDO</h2>
              <button onClick={onClose} aria-label="Cerrar carrito">
                <X className="h-6 w-6" />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <ShoppingBag className="h-12 w-12 text-charcoal-200" />
                <p className="text-charcoal-400">Tu carrito está vacío. Hora de morder algo delicioso.</p>
                <Link href="/menu" onClick={onClose}>
                  <Button>Ver el menú</Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5">
                  <ul className="space-y-4">
                    {items.map((item) => (
                      <li key={item.key} className="flex gap-3 border-b border-charcoal-100 pb-4 dark:border-charcoal-700">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-charcoal-100">
                          {item.image && (
                            <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-charcoal-900 dark:text-cream">{item.name}</p>
                          {item.extras.length > 0 && (
                            <p className="text-xs text-charcoal-400">{item.extras.map((e) => e.name).join(", ")}</p>
                          )}
                          {item.notes && <p className="text-xs italic text-charcoal-400">&ldquo;{item.notes}&rdquo;</p>}
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 rounded-full border border-charcoal-200 dark:border-charcoal-600">
                              <button
                                onClick={() => updateQuantity(item.key, item.quantity - 1)}
                                className="flex h-7 w-7 items-center justify-center"
                                aria-label="Restar"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-4 text-center text-sm">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.key, item.quantity + 1)}
                                className="flex h-7 w-7 items-center justify-center"
                                aria-label="Sumar"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-ember-600">
                              {formatCOP((item.unitPrice + item.extras.reduce((s, e) => s + e.price, 0)) * item.quantity)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.key)}
                          aria-label="Eliminar producto"
                          className="text-charcoal-300 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-charcoal-100 p-5 dark:border-charcoal-700">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-charcoal-500 dark:text-charcoal-300">Subtotal</span>
                    <span className="font-display text-2xl">{formatCOP(subtotal)}</span>
                  </div>
                  <Link href="/carrito" onClick={onClose}>
                    <Button className="w-full" size="lg">
                      Ir a pagar
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
