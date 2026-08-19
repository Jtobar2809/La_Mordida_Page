"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Receipt } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { anularVenta } from "@/actions/admin/caja";
import { formatCOP } from "@/lib/utils";
import { ETIQUETA_METODO } from "@/types/caja";
import type { MetodoPago, OrderStatus } from "@prisma/client";

export type VentaResumida = {
  id: string;
  total: number;
  status: OrderStatus;
  metodoPago: MetodoPago | null;
  createdAt: Date;
  items: { quantity: number; product: { name: string } }[];
};

export function VentasDelTurno({ ventas }: { ventas: VentaResumida[] }) {
  const [anulando, setAnulando] = React.useState<VentaResumida | null>(null);

  if (ventas.length === 0) return null;

  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
        <Receipt className="h-4 w-4" /> Ventas de este turno
      </h2>

      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        {ventas.map((venta) => {
          const anulada = venta.status === "CANCELADO";
          return (
            <div
              key={venta.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                anulada ? "opacity-50" : "hover:bg-charcoal-50 dark:hover:bg-charcoal-700/50"
              }`}
            >
              <span className="font-mono text-xs text-charcoal-400">{venta.id.slice(-6).toUpperCase()}</span>

              <span className="flex-1 truncate text-charcoal-700 dark:text-charcoal-200">
                {venta.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ")}
              </span>

              <span className="hidden text-xs text-charcoal-400 sm:inline">
                {venta.metodoPago ? ETIQUETA_METODO[venta.metodoPago] : "—"}
              </span>

              <span className={`font-mono font-semibold ${anulada ? "line-through" : "text-charcoal-900 dark:text-cream"}`}>
                {formatCOP(venta.total)}
              </span>

              {anulada ? (
                <span className="text-[10px] font-bold uppercase text-red-500">Anulada</span>
              ) : (
                <button
                  onClick={() => setAnulando(venta)}
                  aria-label={`Anular venta ${venta.id.slice(-6).toUpperCase()}`}
                  className="text-charcoal-300 transition-colors hover:text-red-500"
                >
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {anulando && <AnularModal venta={anulando} onClose={() => setAnulando(null)} />}
    </div>
  );
}

function AnularModal({ venta, onClose }: { venta: VentaResumida; onClose: () => void }) {
  const router = useRouter();
  const [motivo, setMotivo] = React.useState("");
  const [cargando, setCargando] = React.useState(false);

  const anular = async () => {
    setCargando(true);
    try {
      const resultado = await anularVenta({ orderId: venta.id, motivo });
      if (!resultado.success) return toast.error(resultado.error);

      toast.success("Venta anulada: se devolvieron los insumos y el dinero del turno");
      onClose();
      router.refresh();
    } catch (error) {
      console.error("Error al anular venta:", error);
      toast.error("Ocurrió un error al anular la venta");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Anular venta ${venta.id.slice(-6).toUpperCase()}`}
      description={`${formatCOP(venta.total)} · ${venta.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ")}`}
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-mustard-50 p-3 text-sm text-mustard-800 dark:bg-mustard-900/20 dark:text-mustard-200">
          Se devolverán los insumos al inventario y se registrará la salida del dinero en el turno. La venta original no
          se borra: queda marcada como anulada para que el movimiento sea auditable.
        </p>

        <div>
          <Label htmlFor="motivoAnulacion">¿Por qué se anula?</Label>
          <Input
            id="motivoAnulacion"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: se cobró de más, el cliente cambió de pedido..."
            autoFocus
          />
        </div>

        <div className="flex gap-3 border-t border-charcoal-100 pt-4 dark:border-charcoal-700">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button variant="destructive" className="flex-1" onClick={anular} disabled={cargando || motivo.trim().length < 3}>
            {cargando ? "Anulando..." : "Anular venta"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
