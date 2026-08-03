"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { upsertProveedor } from "@/actions/admin/proveedores";
import type { Proveedor } from "@prisma/client";

export function ProveedorForm({ proveedor, onDone }: { proveedor: Proveedor | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    nombre: proveedor?.nombre ?? "",
    contacto: proveedor?.contacto ?? "",
    telefono: proveedor?.telefono ?? "",
    email: proveedor?.email ?? "",
    activo: proveedor?.activo ?? true,
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertProveedor({ id: proveedor?.id, ...form });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success(proveedor ? "Proveedor actualizado" : "Proveedor creado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nombre">Nombre del proveedor</Label>
        <Input id="nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Carnes del Cauca" />
      </div>
      <div>
        <Label htmlFor="contacto">Persona de contacto</Label>
        <Input id="contacto" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} placeholder="Ej: Don Jairo" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="Ej: 3001234567" />
        </div>
        <div>
          <Label htmlFor="email">Correo</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>
      {proveedor && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 accent-ember-600" />
          Activo (disponible para asignar a insumos y compras)
        </label>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : proveedor ? "Guardar cambios" : "Crear proveedor"}
      </Button>
    </form>
  );
}
