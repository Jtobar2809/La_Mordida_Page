"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { registrarRetiroSocio } from "@/actions/admin/caja";
import { formatCOP, cn } from "@/lib/utils";
import type { CupoRetiros } from "@/lib/retiros";
import type { SesionCajaActiva } from "@/types/caja";

/** Los montos que de verdad se sacan, para no teclear los ceros cada vez. */
const MONTOS_RAPIDOS = [20000, 50000, 100000, 200000];

/**
 * Retiro de socios: la plata que los dueños sacan para vivir.
 *
 * La pantalla tiene un solo trabajo además de guardar el movimiento: que quien
 * retira vea, ANTES de confirmar, cuánto le queda del cupo del mes. Sin eso el
 * cupo es un número en una hoja de cálculo que nadie consulta, y a fin de mes
 * la sorpresa es que se sacaron $1.200.000 sin que nadie lo notara.
 */
export function RetiroSocioModal({
  sesion,
  cupo,
  onClose,
}: {
  sesion: SesionCajaActiva;
  cupo: CupoRetiros;
  onClose: () => void;
}) {
  const router = useRouter();
  const [monto, setMonto] = React.useState("");
  const [metodo, setMetodo] = React.useState<"EFECTIVO" | "NEQUI" | "OTRO">("EFECTIVO");
  const [concepto, setConcepto] = React.useState("");
  const [cargando, setCargando] = React.useState(false);

  const montoNumero = Math.max(Number(monto) || 0, 0);
  const disponibleCajon = sesion.resumen.esperadoEfectivo;

  // Dos límites que no son lo mismo: el cajón manda (no se puede sacar plata
  // que no está) y el cupo solo aconseja (es la plata de los socios).
  const excedeCajon = metodo === "EFECTIVO" && montoNumero > disponibleCajon;
  const saldoTrasRetiro = cupo.saldo - montoNumero;
  const excedeCupo = cupo.hayPresupuesto && saldoTrasRetiro < 0;

  const usadoPct = Math.min(cupo.usadoPct, 100);
  const pctTrasRetiro = cupo.hayPresupuesto
    ? Math.min(((cupo.retirado + montoNumero) / cupo.presupuesto) * 100, 100)
    : 0;

  const guardar = async () => {
    setCargando(true);
    try {
      const resultado = await registrarRetiroSocio({
        monto: montoNumero,
        metodo,
        concepto: concepto.trim() || undefined,
      });
      if (!resultado.success) return toast.error(resultado.error);

      const { saldo, exceso } = resultado.data;
      if (exceso > 0) {
        toast.warning(`Retiro registrado. Van ${formatCOP(exceso)} por encima del cupo del mes.`);
      } else {
        toast.success(`Retiro registrado. Quedan ${formatCOP(saldo)} del cupo del mes.`);
      }

      onClose();
      router.refresh();
    } catch (error) {
      console.error("Error al registrar retiro de socios:", error);
      toast.error("Ocurrió un error al registrar el retiro");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Retiro de socios"
      description="La plata que los dueños sacan para ellos. No es un gasto del negocio: se descuenta del cupo del mes."
    >
      <div className="space-y-4">
        {/* ── Cupo del mes ─────────────────────────────────────────────── */}
        {cupo.hayPresupuesto ? (
          <div className="rounded-2xl border border-charcoal-100 p-4 dark:border-charcoal-700">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">Cupo del mes</p>
              <p className="font-mono text-sm text-charcoal-500 dark:text-charcoal-300">
                {formatCOP(cupo.retirado)} de {formatCOP(cupo.presupuesto)}
              </p>
            </div>

            {/* Lo ya retirado en firme; encima, en un tono más claro, lo que
                agregaría este retiro. Ver la barra moverse mientras se escribe
                el monto es lo que hace pensar antes de confirmar. */}
            <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-charcoal-100 dark:bg-charcoal-700">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all",
                  cupo.exceso > 0 || excedeCupo ? "bg-red-400/40" : "bg-ember-300/50"
                )}
                style={{ width: `${pctTrasRetiro}%` }}
              />
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all",
                  cupo.exceso > 0 ? "bg-red-500" : "bg-ember-500"
                )}
                style={{ width: `${usadoPct}%` }}
              />
            </div>

            <p
              className={cn(
                "mt-2 text-xs",
                cupo.exceso > 0 || excedeCupo ? "font-semibold text-red-600" : "text-charcoal-400"
              )}
            >
              {cupo.exceso > 0
                ? `Ya van ${formatCOP(cupo.exceso)} por encima del cupo de este mes.`
                : excedeCupo
                  ? `Con este retiro se pasan ${formatCOP(-saldoTrasRetiro)} del cupo.`
                  : `Quedan ${formatCOP(cupo.saldo)} disponibles este mes.`}
            </p>
          </div>
        ) : (
          <p className="rounded-2xl bg-mustard-50 p-3 text-xs text-mustard-800 dark:bg-mustard-900/20 dark:text-mustard-200">
            No hay un cupo mensual configurado. Créalo en Costos fijos como una línea marcada como retiro de socios y
            aquí aparecerá cuánto queda.
          </p>
        )}

        {/* ── Monto ────────────────────────────────────────────────────── */}
        <div>
          <Label htmlFor="montoRetiro">Monto</Label>
          <Input
            id="montoRetiro"
            type="number"
            inputMode="numeric"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0"
            autoFocus
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {MONTOS_RAPIDOS.map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setMonto(String(valor))}
                className="rounded-full border border-charcoal-200 px-3 py-1 font-mono text-xs font-medium text-charcoal-600 transition-colors hover:border-ember-500 hover:text-ember-600 dark:border-charcoal-600 dark:text-charcoal-200"
              >
                {formatCOP(valor)}
              </button>
            ))}
          </div>
          {metodo === "EFECTIVO" && (
            <p className={cn("mt-1.5 text-xs", excedeCajon ? "font-semibold text-red-600" : "text-charcoal-400")}>
              {excedeCajon
                ? `Solo hay ${formatCOP(disponibleCajon)} en el cajón.`
                : `Disponible en el cajón: ${formatCOP(disponibleCajon)}`}
            </p>
          )}
        </div>

        {/* ── Medio ────────────────────────────────────────────────────── */}
        <div>
          <Label htmlFor="metodoRetiro">Medio</Label>
          <Select id="metodoRetiro" value={metodo} onChange={(e) => setMetodo(e.target.value as typeof metodo)}>
            <option value="EFECTIVO">Efectivo del cajón (afecta el arqueo)</option>
            <option value="NEQUI">Nequi</option>
            <option value="OTRO">Otro</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="conceptoRetiro">Nota (opcional)</Label>
          <Input
            id="conceptoRetiro"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej: mercado de la casa"
          />
        </div>

        <div className="flex gap-3 border-t border-charcoal-100 pt-4 dark:border-charcoal-700">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={guardar} disabled={cargando || excedeCajon || montoNumero <= 0}>
            {cargando ? "Guardando..." : excedeCupo ? "Retirar de todos modos" : "Registrar retiro"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
