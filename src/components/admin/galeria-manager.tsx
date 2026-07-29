"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { GaleriaForm } from "@/components/admin/galeria-form";
import { deleteGalleryImage, toggleGalleryImageActive } from "@/actions/admin/galeria";
import type { GalleryImage } from "@prisma/client";

export function GaleriaManager({ images }: { images: GalleryImage[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<GalleryImage | null | undefined>(undefined);

  const handleDelete = async (id: string, title?: string) => {
    if (!confirm(`¿Eliminar esta imagen de la galería?`)) return;
    const result = await deleteGalleryImage(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Imagen eliminada");
    router.refresh();
  };

  const handleToggle = async (id: string, current: boolean) => {
    const result = await toggleGalleryImageActive(id, !current);
    if (!result.success) return toast.error(result.error);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nueva imagen
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => (
          <div key={img.id} className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
            <div className="relative h-40 w-full bg-charcoal-100">
              {img.image ? (
                <Image src={img.image} alt={img.alt ?? "Galería"} fill className="object-cover" sizes="400px" unoptimized />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-charcoal-300" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="mb-2 flex items-start justify-between">
                <p className="font-semibold text-charcoal-900 dark:text-cream">{img.alt ?? "Sin descripción"}</p>
                <button onClick={() => handleToggle(img.id, img.active)}>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${img.active ? "bg-olive-100 text-olive-800" : "bg-charcoal-100 text-charcoal-700"}`}>{img.active ? "Visible" : "Oculto"}</span>
                </button>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <Button size="icon" variant="ghost" onClick={() => setEditing(img)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(img.id)} aria-label="Eliminar">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {images.length === 0 && <p className="p-8 text-center text-sm text-charcoal-400">Aún no hay imágenes en la galería. Agrega la primera.</p>}

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "Editar imagen" : "Nueva imagen"}>
        <GaleriaForm
          gallery={editing ?? null}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
