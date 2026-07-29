"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { upsertGalleryImage } from "@/actions/admin/galeria";
import type { GalleryImage } from "@prisma/client";

export function GaleriaForm({ gallery, onDone }: { gallery: GalleryImage | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    image: gallery?.image ?? "",
    alt: gallery?.alt ?? "",
    order: gallery?.order ?? 0,
    active: gallery?.active ?? true,
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertGalleryImage({ id: gallery?.id, ...form });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success(gallery ? "Imagen actualizada" : "Imagen creada");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ImageUploader value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Imagen de galería (recomendado 800x800)" />
      <div>
        <Label htmlFor="alt">Texto alternativo</Label>
        <Input id="alt" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} placeholder="Descripción breve" />
      </div>
      <div>
        <Label htmlFor="order">Orden</Label>
        <Input id="order" type="number" value={String(form.order)} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-ember-600" />
        Visible en el sitio
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : gallery ? "Guardar cambios" : "Crear imagen"}
      </Button>
    </form>
  );
}
