import { prisma } from "@/lib/prisma";
import { BannersManager } from "@/components/admin/banners-manager";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  const banners = await prisma.banner.findMany({ orderBy: { order: "asc" } });

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">BANNERS</h1>
      <p className="mb-6 text-sm text-charcoal-400">Promociones destacadas que aparecen en la sección &ldquo;Promociones&rdquo; del inicio.</p>
      <BannersManager banners={banners} />
    </div>
  );
}
