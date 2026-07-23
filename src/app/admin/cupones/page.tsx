import { prisma } from "@/lib/prisma";
import { CouponsManager } from "@/components/admin/coupons-manager";

export const dynamic = "force-dynamic";

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CUPONES</h1>
      <p className="mb-6 text-sm text-charcoal-400">Códigos de descuento que los clientes pueden aplicar en el checkout.</p>
      <CouponsManager coupons={coupons} />
    </div>
  );
}
