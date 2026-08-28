"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { registrarArqueoNequi } from "@/actions/admin/nequi";
import { formatCOP } from "@/lib/utils";

/**
 * Contar el Nequi: se abre la app, se mira el saldo y se escribe aquí.
 *
 * El esperado se muestra pero NO se envía: lo recalcula el servidor al guardar.
 * Enviarlo desde aquí dejaría firmada una diferencia contra un número que ya
 * cambió si la pestaña llevaba horas abierta.
 */
export function ArqueoNequiModal({ esperado, onClose }: { esperado: number; onClose: () => void }) {
  const router = useRouter();
  const [saldoReal, setSaldoReal] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [cargando, setCargando] = React.useState(false);

  // En vivo, mientras escribe: ver la diferencia aparecer es lo que hace que
  // uno revise el número antes de guardarlo, no después.
  const escrito = saldoReal.trim() === "" ? null : Number(saldoReal);
  const diferencia = escrito === null || Number.isNaN(escrito) ? null : escrito - esperado;

  const guardar = async () => {
    setCargando(true);
    try {
      const resultado = await registrarArqueoNequi({ saldoReal: Number(saldoReal), notas });
      if (!resultado.success) return toast.error(resultado.error);

      const { diferencia: dif } = resultado.data;
      toast.success(
        dif === 0
          ? "Nequi cuadró exacto"
          : dif > 0
            ? `Arqueo guardado: sobran ${formatCOP(dif)}`
            : `Arqueo guardado: faltan ${formatCOP(Math.abs(dif))}`
      );
      onClose();
      router.refresh();
    } catch (error) {
      console.error("Error al registrar el arqueo de Nequi:", error);
      toast.error("Ocurrió un error al guardar el arqueo");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Contar el Nequi"
      description="Abre la app, mira el saldo y escríbelo tal cual. De ahí en adelante el sistema cuenta desde ese número."
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-charcoal-50 p-3 text-sm dark:bg-charcoal-900/40">
          <p className="text-xs text-charcoal-400">El sistema espera</p>
          <p className="font-mono text-xl font-bold text-charcoal-900 dark:text-cream">{formatCOP(esperado)}</p>
        </div>

        <div>
          <Label htmlFor="saldoRealNequi">Saldo que muestra la app</Label>
          <Input
            id="saldoRealNequi"
            type="number"
            inputMode="numeric"
            min={0}
            value={saldoReal}
            onChange={(e) => setSaldoReal(e.target.value)}
            placeholder="0"
            autoFocus
          />
          {diferencia !== null && (
            <p
              className={`mt-1.5 text-xs ${
                diferencia === 0
                  ? "text-olive-600 dark:text-olive-400"
                  : diferencia < 0
                    ? "font-semibold text-red-600 dark:text-red-400"
                    : "font-semibold text-mustard-700 dark:text-mustard-300"
              }`}
            >
              {diferencia === 0
                ? "Cuadra exacto."
                : diferencia < 0
                  ? `Faltan ${formatCOP(Math.abs(diferencia))}. Puede ser un pago por Nequi que no se registró.`
                  : `Sobran ${formatCOP(diferencia)}. Puede ser una venta cobrada por Nequi que no se anotó.`}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="notasArqueoNequi">Notas (opcional)</Label>
          <Textarea
            id="notasArqueoNequi"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Si hay diferencia, escribe a qué crees que se debe."
          />
        </div>

        <p className="rounded-xl bg-mustard-50 p-3 text-xs text-mustard-800 dark:bg-mustard-900/20 dark:text-mustard-200">
          Guardar no corrige nada hacia atrás: deja constancia de la diferencia y vuelve a arrancar la cuenta desde el
          saldo real. Los movimientos viejos se quedan como están.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={cargando || saldoReal.trim() === ""}>
            {cargando ? "Guardando…" : "Guardar arqueo"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
