"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { BannerForm } from "@/components/admin/banner-form";
import { deleteBanner, toggleBannerActive } from "@/actions/admin/banners";
import type { Banner } from "@prisma/client";

export function BannersManager({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Banner | null | undefined>(undefined);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar el banner "${title}"?`)) return;
    const result = await deleteBanner(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Banner eliminado");
    router.refresh();
  };

  const handleToggle = async (id: string, current: boolean) => {
    const result = await toggleBannerActive(id, !current);
    if (!result.success) return toast.error(result.error);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nuevo banner
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((banner) => (
          <div key={banner.id} className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
            <div className="relative h-32 w-full bg-charcoal-100">
              {banner.image ? (
                <Image src={banner.image} alt={banner.title} fill className="object-cover" sizes="400px" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-charcoal-300" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="mb-2 flex items-start justify-between">
                <p className="font-semibold text-charcoal-900 dark:text-cream">{banner.title}</p>
                <button onClick={() => handleToggle(banner.id, banner.active)}>
                  <Badge variant={banner.active ? "olive" : "charcoal"}>{banner.active ? "Visible" : "Oculto"}</Badge>
                </button>
              </div>
              <Badge variant={banner.placement === "HERO" ? "ember" : "charcoal"} className="mb-2">
                {banner.placement === "HERO" ? "Carrusel del inicio" : "Promociones"}
              </Badge>
              {banner.subtitle && <p className="text-sm text-charcoal-400">{banner.subtitle}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <Button size="icon" variant="ghost" onClick={() => setEditing(banner)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(banner.id, banner.title)} aria-label="Eliminar">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {banners.length === 0 && <p className="p-8 text-center text-sm text-charcoal-400">Aún no hay banners. Crea el primero para la sección de promociones.</p>}

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "Editar banner" : "Nuevo banner"}>
        <BannerForm
          banner={editing ?? null}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
