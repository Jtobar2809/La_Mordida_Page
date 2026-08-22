"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { registrarMovimientoCaja } from "@/actions/admin/caja";
import { formatCOP } from "@/lib/utils";
import type { SesionCajaActiva } from "@/types/caja";

/** Conceptos que se repiten todos los días, para no escribirlos a mano. */
const SUGERENCIAS: Record<"INGRESO" | "EGRESO", string[]> = {
  INGRESO: ["Base adicional", "Cobro de pedido anterior", "Devolución de proveedor"],
  EGRESO: ["Pago a proveedor", "Domicilio", "Retiro a caja fuerte", "Gasto de cocina"],
};

export function MovimientoCajaModal({
  tipo,
  sesion,
  onClose,
}: {
  tipo: "INGRESO" | "EGRESO";
  sesion: SesionCajaActiva;
  onClose: () => void;
}) {
  const router = useRouter();
  const [monto, setMonto] = React.useState("");
  const [concepto, setConcepto] = React.useState("");
  const [metodo, setMetodo] = React.useState<"EFECTIVO" | "NEQUI" | "OTRO">("EFECTIVO");
  const [cargando, setCargando] = React.useState(false);

  const esEgreso = tipo === "EGRESO";
  const disponible = sesion.resumen.esperadoEfectivo;
  const excedeCaja = esEgreso && metodo === "EFECTIVO" && Number(monto) > disponible;

  const guardar = async () => {
    setCargando(true);
    try {
      const resultado = await registrarMovimientoCaja({ tipo, metodo, monto: Number(monto), concepto });
      if (!resultado.success) return toast.error(resultado.error);

      toast.success(esEgreso ? "Egreso registrado" : "Ingreso registrado");
      onClose();
      router.refresh();
    } catch (error) {
      console.error("Error al registrar movimiento de caja:", error);
      toast.error("Ocurrió un error al registrar el movimiento");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={esEgreso ? "Registrar egreso" : "Registrar ingreso"}
      description={
        esEgreso
          ? "Plata que sale del cajón sin ser una devolución de venta."
          : "Plata que entra al cajón sin ser una venta."
      }
    >
      <div className="space-y-4">
        {esEgreso && (
          // Un retiro anotado como egreso se contaría como costo de operar y
          // además no descontaría del cupo del mes: las dos cosas que el botón
          // aparte vino a arreglar. Barato avisarlo aquí.
          <p className="rounded-xl bg-mustard-50 p-3 text-xs text-mustard-800 dark:bg-mustard-900/20 dark:text-mustard-200">
            ¿Es plata para los socios? Cierra este modal y usa <strong>Retiro socio</strong>: eso descuenta del cupo del
            mes y no se cuenta como gasto del negocio.
          </p>
        )}
        <div>
          <Label htmlFor="montoMovimiento">Monto</Label>
          <Input
            id="montoMovimiento"
            type="number"
            inputMode="numeric"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            autoFocus
          />
          {esEgreso && metodo === "EFECTIVO" && (
            <p className={`mt-1.5 text-xs ${excedeCaja ? "font-semibold text-red-600" : "text-charcoal-400"}`}>
              {excedeCaja
                ? `Solo hay ${formatCOP(disponible)} en el cajón.`
                : `Disponible en el cajón: ${formatCOP(disponible)}`}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="metodoMovimiento">Medio</Label>
          <Select
            id="metodoMovimiento"
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as typeof metodo)}
          >
            <option value="EFECTIVO">Efectivo (afecta el arqueo del cajón)</option>
            <option value="NEQUI">Nequi</option>
            <option value="OTRO">Otro</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="conceptoMovimiento">¿Para qué fue?</Label>
          <Input
            id="conceptoMovimiento"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder={esEgreso ? "Ej: pago del pan de hoy" : "Ej: base adicional del dueño"}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGERENCIAS[tipo].map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                onClick={() => setConcepto(sugerencia)}
                className="rounded-full border border-charcoal-200 px-3 py-1 text-xs font-medium text-charcoal-600 transition-colors hover:border-ember-500 hover:text-ember-600 dark:border-charcoal-600 dark:text-charcoal-200"
              >
                {sugerencia}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 border-t border-charcoal-100 pt-4 dark:border-charcoal-700">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={guardar}
            disabled={cargando || excedeCaja || !monto || concepto.trim().length < 3}
          >
            {cargando ? "Guardando..." : "Registrar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
