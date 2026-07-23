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

/**
 * Valida que un valor parseado de localStorage tenga la forma real de
 * CartState antes de confiar en él. Un JSON.parse exitoso no garantiza
 * que el resultado sea { items: CartItem[] } — puede ser localStorage
 * de un schema anterior, null, un array suelto, etc. Sin esta validación
 * de forma, un CartState malformado se cuela al estado y provoca un
 * crash en el primer .reduce()/.map() sobre item.extras o item.quantity.
 */
function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.key === "string" &&
    typeof item.productId === "string" &&
    typeof item.name === "string" &&
    typeof item.unitPrice === "number" &&
    typeof item.quantity === "number" &&
    Array.isArray(item.extras) &&
    item.extras.every(
      (e) =>
        e &&
        typeof e === "object" &&
        typeof (e as CartExtra).id === "string" &&
        typeof (e as CartExtra).name === "string" &&
        typeof (e as CartExtra).price === "number"
    )
  );
}

function parseStoredCart(raw: string): CartState {
  const parsed: unknown = JSON.parse(raw);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as Record<string, unknown>).items) ||
    !(parsed as { items: unknown[] }).items.every(isValidCartItem)
  ) {
    throw new Error("Formato de carrito inválido en localStorage");
  }
  return parsed as CartState;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<CartState>({ items: [] });
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setState(parseStoredCart(raw));
      }
    } catch {
      // Carrito corrupto o de un schema anterior: se descarta y se limpia
      // el storage para no volver a fallar en la próxima carga.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // localStorage no disponible (modo privado, etc.) — ignorar
      }
      setState({ items: [] });
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

  const subtotal = (Array.isArray(state.items) ? state.items : []).reduce((sum, item) => {
    const extrasTotal = (Array.isArray(item.extras) ? item.extras : []).reduce((s, e) => s + e.price, 0);
    return sum + (item.unitPrice + extrasTotal) * item.quantity;
  }, 0);

  const itemCount = (Array.isArray(state.items) ? state.items : []).reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items: Array.isArray(state.items) ? state.items : [], addItem, updateQuantity, removeItem, clear, subtotal, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
