"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleCodeActive, deleteCode } from "@/actions/admin/codes";
import { formatDate } from "@/lib/utils";
import type { RedemptionCode } from "@prisma/client";

export function CodesTable({ codes }: { codes: RedemptionCode[] }) {
  const router = useRouter();

  const handleToggle = async (id: string, active: boolean) => {
    const result = await toggleCodeActive(id, !active);
    if (!result.success) return toast.error(result.error);
    router.refresh();
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`¿Eliminar el código ${code}?`)) return;
    const result = await deleteCode(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Código eliminado");
    router.refresh();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
      <table className="w-full text-sm">
        <thead className="border-b border-charcoal-100 bg-charcoal-50 text-left text-xs uppercase tracking-wide text-charcoal-400 dark:border-charcoal-700 dark:bg-charcoal-900/40">
          <tr>
            <th className="px-4 py-3">Código</th>
            <th className="px-4 py-3">Puntos</th>
            <th className="px-4 py-3">Usos</th>
            <th className="px-4 py-3">Expira</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
          {codes.map((code) => (
            <tr key={code.id}>
              <td className="px-4 py-3 font-mono font-bold">{code.code}</td>
              <td className="px-4 py-3">{code.pointsValue}</td>
              <td className="px-4 py-3">
                {code.uses}/{code.maxUses}
              </td>
              <td className="px-4 py-3 text-charcoal-400">{code.expiresAt ? formatDate(code.expiresAt) : "—"}</td>
              <td className="px-4 py-3">
                <button onClick={() => handleToggle(code.id, code.active)}>
                  <Badge variant={code.active ? "olive" : "charcoal"}>{code.active ? "Activo" : "Inactivo"}</Badge>
                </button>
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="icon" variant="ghost" onClick={() => handleDelete(code.id, code.code)} aria-label="Eliminar">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {codes.length === 0 && <p className="p-8 text-center text-sm text-charcoal-400">Aún no has generado códigos.</p>}
    </div>
  );
}
