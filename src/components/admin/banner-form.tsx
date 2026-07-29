"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/admin/image-uploader";
import { upsertBanner } from "@/actions/admin/banners";
import type { Banner } from "@prisma/client";

export function BannerForm({ banner, onDone }: { banner: Banner | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    title: banner?.title ?? "",
    subtitle: banner?.subtitle ?? "",
    image: banner?.image ?? "",
    link: banner?.link ?? "",
    order: banner?.order ?? 0,
    active: banner?.active ?? true,
    placement: banner?.placement ?? "PROMOCIONES",
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertBanner({ id: banner?.id, ...form });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success(banner ? "Banner actualizado" : "Banner creado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ImageUploader value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Imagen del banner (recomendado 1200x600)" />
      <div>
        <Label htmlFor="placement">Ubicación</Label>
        <Select
          id="placement"
          value={form.placement}
          onChange={(e) => setForm({ ...form, placement: e.target.value as "HERO" | "PROMOCIONES" })}
        >
          <option value="HERO">Carrusel del inicio (Hero)</option>
          <option value="PROMOCIONES">Sección de Promociones</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="title">Título</Label>
        <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej: 2x1 en perros artesanales" />
      </div>
      <div>
        <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
        <Input id="subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Ej: Solo los martes de julio" />
      </div>
      <div>
        <Label htmlFor="link">Enlace al hacer clic (opcional)</Label>
        <Input id="link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/menu" />
      </div>
      <div>
        <Label htmlFor="order">Orden de aparición</Label>
        <Input id="order" type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 accent-ember-600" />
        Visible en el sitio
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : banner ? "Guardar cambios" : "Crear banner"}
      </Button>
    </form>
  );
}
