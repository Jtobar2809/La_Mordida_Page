"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { updateOrderStatus } from "@/actions/orders";
import { formatCOP, formatDateTime } from "@/lib/utils";

type OrderRow = {
  id: string;
  status: string;
  deliveryType: string;
  total: number;
  createdAt: Date;
  user: { name: string | null; phone: string | null };
  items: { quantity: number; product: { name: string } }[];
};

const statusOptions = ["PENDIENTE", "CONFIRMADO", "EN_PREPARACION", "EN_CAMINO", "ENTREGADO", "CANCELADO"];

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();

  const handleStatusChange = async (id: string, status: string) => {
    const result = await updateOrderStatus(id, status);
    if (!result.success) return toast.error(result.error);
    toast.success("Estado actualizado");
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
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-3">
                <p className="font-mono font-semibold">#{order.id.slice(-6).toUpperCase()}</p>
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
                <Badge variant="charcoal">{order.deliveryType === "DOMICILIO" ? "Domicilio" : "Recoge"}</Badge>
              </td>
              <td className="px-4 py-3 font-mono font-bold text-ember-600">{formatCOP(order.total)}</td>
              <td className="px-4 py-3">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <p className="p-8 text-center text-sm text-charcoal-400">Aún no hay pedidos.</p>}
    </div>
  );
}
