"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createManualOrder } from "@/actions/orders";
import { formatCOP, cn } from "@/lib/utils";
import type { ProductWithExtras } from "@/types/menu";

type ManualItem = {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  extras: ProductWithExtras["extras"];
  selectedExtraIds: string[];
  notes: string;
};

const statusOptions = ["PENDIENTE", "CONFIRMADO", "EN_PREPARACION", "EN_CAMINO", "ENTREGADO", "CANCELADO"];

export function ManualOrderButton({ products }: { products: ProductWithExtras[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [deliveryType, setDeliveryType] = React.useState<"DOMICILIO" | "RECOGE_EN_TIENDA">("RECOGE_EN_TIENDA");
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [status, setStatus] = React.useState("ENTREGADO");
  const [pickedProductId, setPickedProductId] = React.useState(products[0]?.id ?? "");
  const [items, setItems] = React.useState<ManualItem[]>([]);

  const reset = () => {
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryType("RECOGE_EN_TIENDA");
    setAddress("");
    setNotes("");
    setStatus("ENTREGADO");
    setItems([]);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const addProduct = () => {
    const product = products.find((p) => p.id === pickedProductId);
    if (!product) return;
    setItems((prev) => [
      ...prev,
      {
        key: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity: 1,
        extras: product.extras,
        selectedExtraIds: [],
        notes: "",
      },
    ]);
  };

  const updateItem = (key: string, patch: Partial<ManualItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const toggleExtra = (key: string, extraId: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.key === key
          ? {
              ...i,
              selectedExtraIds: i.selectedExtraIds.includes(extraId)
                ? i.selectedExtraIds.filter((id) => id !== extraId)
                : [...i.selectedExtraIds, extraId],
            }
          : i
      )
    );
  };

  const itemTotal = (item: ManualItem) => {
    const extrasTotal = item.extras
      .filter((e) => item.selectedExtraIds.includes(e.id))
      .reduce((s, e) => s + e.price, 0);
    return (item.unitPrice + extrasTotal) * item.quantity;
  };

  const subtotal = items.reduce((sum, item) => sum + itemTotal(item), 0);

  const handleSubmit = async () => {
    if (!customerName.trim()) return toast.error("Escribe el nombre del cliente");
    if (items.length === 0) return toast.error("Agrega al menos un producto");
    if (deliveryType === "DOMICILIO" && !address.trim()) return toast.error("Ingresa una dirección de entrega");

    setLoading(true);
    try {
      const result = await createManualOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          extraIds: i.selectedExtraIds,
          notes: i.notes.trim() || undefined,
        })),
        deliveryType,
        address: deliveryType === "DOMICILIO" ? address.trim() : undefined,
        notes: notes.trim() || undefined,
        status,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Pedido registrado");
      close();
      router.refresh();
    } catch (err) {
      console.error("Error al crear pedido manual:", err);
      toast.error("Ocurrió un error al crear el pedido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Nuevo pedido manual
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Pedido manual"
        description="Para clientes que compran en el sitio físico."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="customerName">Nombre del cliente</Label>
              <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ej: Juan Pérez" />
            </div>
            <div>
              <Label htmlFor="customerPhone">Teléfono (opcional)</Label>
              <Input id="customerPhone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Ej: 3001234567" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Productos</p>
            <div className="flex gap-2">
              <Select value={pickedProductId} onChange={(e) => setPickedProductId(e.target.value)} className="flex-1">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatCOP(p.price)}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="outline" onClick={addProduct}>
                Agregar
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-charcoal-200 py-6 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
                <ShoppingBag className="h-6 w-6" />
                Todavía no has agregado productos
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <div key={item.key} className="rounded-xl border border-charcoal-100 p-3 dark:border-charcoal-700">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-charcoal-900 dark:text-cream">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-charcoal-200 px-1.5 py-0.5 dark:border-charcoal-600">
                        <button
                          onClick={() => updateItem(item.key, { quantity: Math.max(1, item.quantity - 1) })}
                          className="flex h-7 w-7 items-center justify-center"
                          aria-label="Restar"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateItem(item.key, { quantity: item.quantity + 1 })}
                          className="flex h-7 w-7 items-center justify-center"
                          aria-label="Sumar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="w-20 text-right font-mono text-sm font-bold text-ember-600">{formatCOP(itemTotal(item))}</span>
                      <button onClick={() => removeItem(item.key)} aria-label="Quitar" className="text-charcoal-300 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {item.extras.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.extras.map((extra) => (
                          <button
                            key={extra.id}
                            type="button"
                            onClick={() => toggleExtra(item.key, extra.id)}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs transition-colors",
                              item.selectedExtraIds.includes(extra.id)
                                ? "border-ember-500 bg-ember-50 text-ember-700 dark:bg-ember-900/20"
                                : "border-charcoal-200 text-charcoal-500 dark:border-charcoal-600 dark:text-charcoal-300"
                            )}
                          >
                            {extra.name}
                            {extra.price > 0 ? ` +${formatCOP(extra.price)}` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-charcoal-100 p-4 dark:border-charcoal-700">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Entrega</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeliveryType("RECOGE_EN_TIENDA")}
                className={cn(
                  "flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                  deliveryType === "RECOGE_EN_TIENDA" ? "border-ember-500 bg-ember-50 dark:bg-ember-900/20" : "border-charcoal-200 dark:border-charcoal-600"
                )}
              >
                🏠 Recoge en tienda
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType("DOMICILIO")}
                className={cn(
                  "flex-1 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                  deliveryType === "DOMICILIO" ? "border-ember-500 bg-ember-50 dark:bg-ember-900/20" : "border-charcoal-200 dark:border-charcoal-600"
                )}
              >
                🛵 A domicilio
              </button>
            </div>
            {deliveryType === "DOMICILIO" && (
              <div className="mt-3">
                <Label htmlFor="manualAddress">Dirección</Label>
                <Input id="manualAddress" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, barrio..." />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manualStatus">Estado del pedido</Label>
              <Select id="manualStatus" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="manualNotes">Notas (opcional)</Label>
              <Textarea id="manualNotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: pagó en efectivo..." />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-charcoal-100 pt-4 dark:border-charcoal-700">
            <div>
              <p className="text-xs text-charcoal-400">Subtotal (sin domicilio/impuestos)</p>
              <p className="font-display text-2xl text-charcoal-900 dark:text-cream">{formatCOP(subtotal)}</p>
            </div>
            <Button onClick={handleSubmit} disabled={loading} size="lg">
              {loading ? "Guardando..." : "Crear pedido"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
