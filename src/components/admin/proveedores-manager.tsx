"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ProveedorForm } from "@/components/admin/proveedor-form";
import { deleteProveedor } from "@/actions/admin/proveedores";
import type { Proveedor } from "@prisma/client";

export function ProveedoresManager({ proveedores }: { proveedores: Proveedor[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Proveedor | null | undefined>(undefined);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el proveedor "${nombre}"?`)) return;
    const result = await deleteProveedor(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Proveedor eliminado");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nuevo proveedor
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {proveedores.map((p) => (
              <tr key={p.id} className="bg-white dark:bg-charcoal-800">
                <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">{p.nombre}</td>
                <td className="px-4 py-3 text-charcoal-400">{p.contacto || "—"}</td>
                <td className="px-4 py-3 text-charcoal-400">{p.telefono || "—"}</td>
                <td className="px-4 py-3 text-charcoal-400">{p.email || "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.activo ? "olive" : "charcoal"}>{p.activo ? "Activo" : "Inactivo"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id, p.nombre)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {proveedores.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-charcoal-400">
                  Aún no hay proveedores registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "Editar proveedor" : "Nuevo proveedor"}>
        <ProveedorForm
          proveedor={editing ?? null}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
