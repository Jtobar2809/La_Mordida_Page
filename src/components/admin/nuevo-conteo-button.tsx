"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { abrirConteo } from "@/actions/admin/conteo";

export function NuevoConteoButton({ hayBorrador }: { hayBorrador: boolean }) {
  const router = useRouter();
  const [cargando, setCargando] = React.useState(false);

  const abrir = async () => {
    setCargando(true);
    const result = await abrirConteo();
    setCargando(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Conteo abierto — el stock quedó congelado para comparar");
    if (result.data) router.push(`/admin/inventario/conteo/${result.data.id}`);
  };

  return (
    <Button onClick={abrir} disabled={cargando || hayBorrador} title={hayBorrador ? "Ya tienes un conteo sin terminar" : undefined}>
      <Plus className="h-4 w-4" />
      {cargando ? "Abriendo..." : "Nueva toma de inventario"}
    </Button>
  );
}
