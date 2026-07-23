"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { CouponForm } from "@/components/admin/coupon-form";
import { deleteCoupon, toggleCouponActive } from "@/actions/admin/coupons";
import { formatCOP, formatDate } from "@/lib/utils";
import type { Coupon } from "@prisma/client";

export function CouponsManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Coupon | null | undefined>(undefined);

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`¿Eliminar el cupón "${code}"?`)) return;
    const result = await deleteCoupon(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Cupón eliminado");
    router.refresh();
  };

  const handleToggle = async (id: string, current: boolean) => {
    const result = await toggleCouponActive(id, !current);
    if (!result.success) return toast.error(result.error);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nuevo cupón
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
        <table className="w-full text-sm">
          <thead className="border-b border-charcoal-100 bg-charcoal-50 text-left text-xs uppercase tracking-wide text-charcoal-400 dark:border-charcoal-700 dark:bg-charcoal-900/40">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descuento</th>
              <th className="px-4 py-3">Pedido mínimo</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Expira</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td className="px-4 py-3 font-mono font-bold">{coupon.code}</td>
                <td className="px-4 py-3">{coupon.discountType === "PORCENTAJE" ? `${coupon.value}%` : formatCOP(coupon.value)}</td>
                <td className="px-4 py-3 text-charcoal-500 dark:text-charcoal-300">{formatCOP(coupon.minOrder)}</td>
                <td className="px-4 py-3">
                  {coupon.used}
                  {coupon.usageLimit ? `/${coupon.usageLimit}` : ""}
                </td>
                <td className="px-4 py-3 text-charcoal-400">{coupon.expiresAt ? formatDate(coupon.expiresAt) : "—"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(coupon.id, coupon.active)}>
                    <Badge variant={coupon.active ? "olive" : "charcoal"}>{coupon.active ? "Activo" : "Inactivo"}</Badge>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(coupon)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(coupon.id, coupon.code)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {coupons.length === 0 && <p className="p-8 text-center text-sm text-charcoal-400">Aún no hay cupones creados.</p>}
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "Editar cupón" : "Nuevo cupón"}>
        <CouponForm
          coupon={editing ?? null}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
