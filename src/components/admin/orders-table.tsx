"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { updateOrderStatus } from "@/actions/orders";
import { registrarPagoPedidoWeb } from "@/actions/admin/caja";
import { formatCOP, formatDateTime } from "@/lib/utils";
import { ETIQUETA_METODO } from "@/types/caja";

type OrderRow = {
  id: string;
  status: string;
  deliveryType: string;
  total: number;
  createdAt: Date;
  inventarioDescontado: boolean;
  canal: "WEB" | "CAJA";
  metodoPago: "EFECTIVO" | "NEQUI" | "OTRO" | null;
  /** Si su plata ya entró a un turno de caja. Ver `registrarPagoPedidoWeb`. */
  pagado: boolean;
  user: { name: string | null; phone: string | null };
  items: { quantity: number; product: { name: string } }[];
};

const statusOptions = ["PENDIENTE", "CONFIRMADO", "EN_PREPARACION", "EN_CAMINO", "ENTREGADO", "CANCELADO"];

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [cobrando, setCobrando] = React.useState<OrderRow | null>(null);

  const handleStatusChange = async (id: string, status: string) => {
    const result = await updateOrderStatus(id, status);
    if (!result.success) return toast.error(result.error);
    toast.success("Estado actualizado");
    // Cancelar un pedido ya pagado devuelve plata, y eso hay que decirlo: o
    // salió del turno abierto, o no había turno y toca anotarlo a mano.
    if (result.aviso) toast.warning(result.aviso, { duration: 8000 });
    router.refresh();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
      <table className="w-full text-sm">
        <thead className="border-b border-charcoal-100 bg-charcoal-50 text-left text-xs uppercase tracking-wide text-charcoal-400 dark:border-charcoal-700 dark:bg-charcoal-900/40">
          <tr>
            <th className="px-4 py-3">Pedido</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Productos</th>
            <th className="px-4 py-3">Entrega</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Pago</th>
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-3">
                <p className="font-mono font-semibold">
                  #{order.id.slice(-6).toUpperCase()}
                  {order.inventarioDescontado && (
                    <PackageCheck className="ml-1.5 inline h-3.5 w-3.5 text-olive-600 dark:text-olive-400" aria-label="Inventario descontado" />
                  )}
                </p>
                <p className="text-xs text-charcoal-400">{formatDateTime(order.createdAt)}</p>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-charcoal-900 dark:text-cream">{order.user.name}</p>
                <p className="text-xs text-charcoal-400">{order.user.phone}</p>
              </td>
              <td className="px-4 py-3 text-charcoal-500 dark:text-charcoal-300">
                {order.items.slice(0, 2).map((i) => `${i.quantity}x ${i.product.name}`).join(", ")}
                {order.items.length > 2 && ` +${order.items.length - 2} más`}
              </td>
              <td className="px-4 py-3">
                {order.canal === "CAJA" ? (
                  <Badge variant="ember">Caja · {ETIQUETA_METODO[order.metodoPago ?? "OTRO"]}</Badge>
                ) : (
                  <Badge variant="charcoal">{order.deliveryType === "DOMICILIO" ? "Domicilio" : "Recoge"}</Badge>
                )}
              </td>
              <td className="px-4 py-3 font-mono font-bold text-ember-600">{formatCOP(order.total)}</td>
              {/*
                La plata de un pedido web no entraba a ningún turno: el cliente
                pagaba por Nequi y el cuadro de saldos no se enteraba nunca.
                Registrarlo es un acto aparte del estado a propósito — el
                domiciliario sale con la comida y vuelve con la plata, a veces
                horas después.
              */}
              <td className="px-4 py-3">
                {order.pagado ? (
                  <Badge variant="olive">{ETIQUETA_METODO[order.metodoPago ?? "OTRO"]}</Badge>
                ) : order.status === "CANCELADO" ? (
                  <span className="text-xs text-charcoal-400">—</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setCobrando(order)} className="text-xs">
                    Registrar pago
                  </Button>
                )}
              </td>
              <td className="px-4 py-3">
                {/*
                  Una venta de mostrador nace cobrada y entregada: no tiene ciclo
                  de vida que administrar. Se muestra fija y con un enlace a la
                  caja, que es el único sitio donde anularla devuelve además el
                  dinero del turno.
                */}
                {order.canal === "CAJA" ? (
                  <div className="flex items-center gap-2">
                    <Badge variant={order.status === "CANCELADO" ? "charcoal" : "olive"}>
                      {order.status === "CANCELADO" ? "Anulada" : "Cobrada"}
                    </Badge>
                    <Link href="/admin/caja" className="text-xs font-medium text-ember-600 hover:underline">
                      Ver en caja
                    </Link>
                  </div>
                ) : (
                  <Select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="h-9 min-w-[9rem] text-xs"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </Select>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="p-8 text-center text-sm text-charcoal-400">Aún no hay pedidos.</p>}

      {cobrando && (
        <PagoPedidoModal
          order={cobrando}
          onClose={() => setCobrando(null)}
          onListo={() => {
            setCobrando(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * Con qué se pagó un pedido de la web, para meter esa plata al turno abierto.
 *
 * Solo efectivo y Nequi: son las dos bolsas que el cuadro de saldos sigue. Un
 * "Otro" acá sería plata que entró y que ningún saldo puede rastrear, que es
 * exactamente el problema que este botón vino a cerrar.
 */
function PagoPedidoModal({
  order,
  onClose,
  onListo,
}: {
  order: OrderRow;
  onClose: () => void;
  onListo: () => void;
}) {
  const [metodo, setMetodo] = React.useState<"EFECTIVO" | "NEQUI">("EFECTIVO");
  const [cargando, setCargando] = React.useState(false);

  const registrar = async () => {
    setCargando(true);
    const result = await registrarPagoPedidoWeb({ orderId: order.id, metodo });
    setCargando(false);
    if (!result.success) return toast.error(result.error, { duration: 8000 });
    toast.success(result.aviso ?? "Pago registrado");
    onListo();
  };

  return (
    <Modal open onClose={onClose} title={`Registrar pago · #${order.id.slice(-6).toUpperCase()}`}>
      <div className="space-y-4">
        <p className="text-sm text-charcoal-400">
          Vas a meter <strong className="text-charcoal-700 dark:text-cream">{formatCOP(order.total)}</strong> al turno
          abierto como una venta. Si no hay caja abierta, no se puede: esa plata no tendría a cuál turno entrar.
        </p>

        <div>
          <label htmlFor="metodoPagoWeb" className="mb-1 block text-sm font-medium">
            ¿Con qué te pagó?
          </label>
          <Select
            id="metodoPagoWeb"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as "EFECTIVO" | "NEQUI")}
          >
            <option value="EFECTIVO">Efectivo</option>
            <option value="NEQUI">Nequi</option>
          </Select>
        </div>

        <div className="flex gap-3 border-t border-charcoal-100 pt-4 dark:border-charcoal-700">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button className="flex-[2]" onClick={registrar} disabled={cargando}>
            {cargando ? "Registrando..." : `Registrar ${formatCOP(order.total)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
