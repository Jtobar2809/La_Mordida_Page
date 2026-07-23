"use client";

import * as React from "react";

export type CartExtra = { id: string; name: string; price: number };

export type CartItem = {
  key: string; // productId + serialized extras, para poder tener el mismo producto con distintos extras
  productId: string;
  name: string;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  notes?: string;
  extras: CartExtra[];
};

type CartState = {
  items: CartItem[];
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "key">) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  subtotal: number;
  itemCount: number;
};

const CartContext = React.createContext<CartContextValue | null>(null);
const STORAGE_KEY = "la-mordida-cart";

function makeKey(productId: string, extras: CartExtra[], notes?: string) {
  const extraIds = extras.map((e) => e.id).sort().join(",");
  return `${productId}::${extraIds}::${notes ?? ""}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<CartState>({ items: [] });
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // ignore parse errors, start fresh
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const addItem: CartContextValue["addItem"] = (item) => {
    const key = makeKey(item.productId, item.extras, item.notes);
    setState((prev) => {
      const existingIndex = prev.items.findIndex((i) => i.key === key);
      const existing = existingIndex >= 0 ? prev.items[existingIndex] : undefined;
      if (existing) {
        const items = [...prev.items];
        items[existingIndex] = { ...existing, quantity: existing.quantity + item.quantity };
        return { items };
      }
      return { items: [...prev.items, { ...item, key }] };
    });
  };

  const updateQuantity: CartContextValue["updateQuantity"] = (key, quantity) => {
    setState((prev) => ({
      items:
        quantity <= 0
          ? prev.items.filter((i) => i.key !== key)
          : prev.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
    }));
  };

  const removeItem: CartContextValue["removeItem"] = (key) => {
    setState((prev) => ({ items: prev.items.filter((i) => i.key !== key) }));
  };

  const clear = () => setState({ items: [] });

  const subtotal = state.items.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    return sum + (item.unitPrice + extrasTotal) * item.quantity;
  }, 0);

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items: state.items, addItem, updateQuantity, removeItem, clear, subtotal, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
