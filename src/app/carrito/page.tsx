"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCart } from "@/hooks/use-cart";
import { formatCOP } from "@/lib/utils";
import { createOrder } from "@/actions/orders";

export default function CartPage() {
  const { data: session, status } = useSession();
  const { items, updateQuantity, removeItem, subtotal, clear } = useCart();
  const router = useRouter();

  const [deliveryType, setDeliveryType] = React.useState<"DOMICILIO" | "RECOGE_EN_TIENDA">("DOMICILIO");
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [couponCode, setCouponCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const deliveryFee = deliveryType === "DOMICILIO" ? 5000 : 0;
  const estimatedTotal = subtotal + deliveryFee;

  const handleCheckout = async () => {
    if (status !== "authenticated") {
      toast.info("Inicia sesión para completar tu pedido");
      router.push("/login?callbackUrl=/carrito");
      return;
    }
    if (deliveryType === "DOMICILIO" && !address.trim()) {
      toast.error("Ingresa una dirección de entrega");
      return;
    }

    // Abrir una ventana en blanco sin URL para evitar que el navegador la bloquee.
    const win = window.open("", "_blank");

    setLoading(true);
    try {
      const result = await createOrder({
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          notes: i.notes,
          extras: i.extras,
        })),
        deliveryType,
        address: deliveryType === "DOMICILIO" ? address : undefined,
        notes,
        couponCode: couponCode || undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? "Error al crear la orden");
        if (win) win.close();
        return;
      }

      clear();
      toast.success("¡Pedido registrado! Te llevamos a WhatsApp para confirmarlo.");

      // Redirigir la ventana abierta al enlace de WhatsApp. Si falla la asignación, abrir directamente.
      if (win) {
        try {
          win.location.href = result.data!.whatsappUrl;
        } catch (e) {
          // fallback
          window.open(result.data!.whatsappUrl, "_blank");
        }
      } else {
        window.open(result.data!.whatsappUrl, "_blank");
      }

      router.push("/cuenta/pedidos");
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Ocurrió un error al procesar el pedido. Intenta de nuevo.");
      if (win) try { win.close(); } catch {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="container-lm py-16">
          <h1 className="font-display text-4xl tracking-wide text-charcoal-900 dark:text-cream sm:text-5xl">TU PEDIDO</h1>

          {items.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-4 text-center">
              <ShoppingBag className="h-14 w-14 text-charcoal-200" />
              <p className="text-charcoal-400">Aún no has agregado nada. Ve al menú y arma tu combinación perfecta.</p>
              <Link href="/menu">
                <Button>Ver el menú</Button>
              </Link>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-4 rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-charcoal-900 dark:text-cream">{item.name}</p>
                      {item.extras.length > 0 && (
                        <p className="text-xs text-charcoal-400">{item.extras.map((e) => e.name).join(", ")}</p>
                      )}
                      {item.notes && <p className="text-xs italic text-charcoal-400">&ldquo;{item.notes}&rdquo;</p>}
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-charcoal-200 dark:border-charcoal-600">
                      <button onClick={() => updateQuantity(item.key, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center" aria-label="Restar">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.key, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center" aria-label="Sumar">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="w-24 text-right font-mono font-bold text-ember-600">
                      {formatCOP((item.unitPrice + item.extras.reduce((s, e) => s + e.price, 0)) * item.quantity)}
                    </span>
                    <button onClick={() => removeItem(item.key)} aria-label="Eliminar" className="text-charcoal-300 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
                  <p className="mb-3 text-sm font-semibold text-charcoal-700 dark:text-cream">Tipo de entrega</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeliveryType("DOMICILIO")}
                      className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                        deliveryType === "DOMICILIO" ? "border-ember-500 bg-ember-50 dark:bg-ember-900/20" : "border-charcoal-200 dark:border-charcoal-600"
                      }`}
                    >
                      🛵 A domicilio
                    </button>
                    <button
                      onClick={() => setDeliveryType("RECOGE_EN_TIENDA")}
                      className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                        deliveryType === "RECOGE_EN_TIENDA" ? "border-ember-500 bg-ember-50 dark:bg-ember-900/20" : "border-charcoal-200 dark:border-charcoal-600"
                      }`}
                    >
                      🏠 Recojo en tienda
                    </button>
                  </div>

                  {deliveryType === "DOMICILIO" && (
                    <div className="mt-4">
                      <Label htmlFor="address">Dirección de entrega</Label>
                      <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, barrio..." />
                    </div>
                  )}

                  <div className="mt-4">
                    <Label htmlFor="notes">Notas del pedido (opcional)</Label>
                    <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: tocar el timbre, sin bolsa plástica..." />
                  </div>

                  <div className="mt-4">
                    <Label htmlFor="coupon">Cupón de descuento (opcional)</Label>
                    <Input id="coupon" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="CODIGO2026" />
                  </div>
                </div>
              </div>

              <div className="h-fit rounded-2xl border border-charcoal-100 bg-white p-6 dark:border-charcoal-700 dark:bg-charcoal-800">
                <h2 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">RESUMEN</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-charcoal-500 dark:text-charcoal-300">
                    <span>Subtotal</span>
                    <span>{formatCOP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-charcoal-500 dark:text-charcoal-300">
                    <span>Domicilio</span>
                    <span>{deliveryType === "DOMICILIO" ? formatCOP(deliveryFee) : "—"}</span>
                  </div>
                  <div className="flex justify-between border-t border-charcoal-100 pt-2 font-display text-2xl text-charcoal-900 dark:border-charcoal-700 dark:text-cream">
                    <span>Total</span>
                    <span>{formatCOP(estimatedTotal)}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-charcoal-400">
                  El total final (con cupón e impuestos si aplican) se confirma al enviar el pedido.
                </p>
                <Button onClick={handleCheckout} disabled={loading} className="mt-6 w-full" size="lg">
                  {loading ? "Enviando..." : "Confirmar y enviar por WhatsApp"}
                </Button>
                {status !== "authenticated" && (
                  <p className="mt-2 text-center text-xs text-charcoal-400">
                    Necesitas <Link href="/login?callbackUrl=/carrito" className="text-ember-600 underline">iniciar sesión</Link> para ganar puntos con este pedido.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
