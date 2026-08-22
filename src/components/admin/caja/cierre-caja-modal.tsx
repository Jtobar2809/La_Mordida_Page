"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cerrarCaja } from "@/actions/admin/caja";
import { formatCOP, cn } from "@/lib/utils";
import type { SesionCajaActiva } from "@/types/caja";

/**
 * Arqueo de cierre. La regla de oro: el sistema NO le dice al cajero cuánto
 * debería haber hasta que ya escribió cuánto contó. Si mostrara el esperado
 * primero, la tentación de "cuadrar" escribiendo ese número en vez de contar de
 * verdad haría que la diferencia siempre fuera cero y el arqueo no serviría
 * para nada.
 */
export function CierreCajaModal({ sesion, onClose }: { sesion: SesionCajaActiva; onClose: () => void }) {
  const router = useRouter();
  const [contado, setContado] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [revelado, setRevelado] = React.useState(false);

  const { resumen } = sesion;
  const contadoNumero = Number(contado) || 0;
  const diferencia = contadoNumero - resumen.esperadoEfectivo;

  const cerrar = async () => {
    if (contado.trim() === "") return toast.error("Escribe cuánto efectivo contaste");

    setCargando(true);
    try {
      const resultado = await cerrarCaja({ efectivoContado: contadoNumero, notas: notas.trim() || undefined });
      if (!resultado.success) return toast.error(resultado.error);

      const dif = resultado.data.diferencia;
      if (dif === 0) toast.success("Caja cerrada y cuadrada exacta");
      else if (dif > 0) toast.success(`Caja cerrada con un sobrante de ${formatCOP(dif)}`);
      else toast.warning(`Caja cerrada con un faltante de ${formatCOP(Math.abs(dif))}`);

      onClose();
      router.refresh();
    } catch (error) {
      console.error("Error al cerrar caja:", error);
      toast.error("Ocurrió un error al cerrar la caja");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Cerrar caja" description={`Turno ${sesion.codigo}`}>
      <div className="space-y-5">
        <div className="space-y-1.5 rounded-2xl border border-charcoal-100 p-4 text-sm dark:border-charcoal-700">
          <Fila etiqueta="Base de apertura" valor={sesion.montoInicial} />
          <Fila etiqueta={`Ventas en efectivo`} valor={resumen.totalEfectivo} />
          <Fila etiqueta="Otros ingresos" valor={resumen.totalIngresos} />
          <Fila etiqueta="Gastos del turno" valor={-resumen.totalEgresos} />
          {resumen.totalRetiros > 0 && <Fila etiqueta="Retiro de socios" valor={-resumen.totalRetiros} />}
          <div className="mt-2 border-t border-charcoal-100 pt-2 dark:border-charcoal-700">
            <Fila etiqueta="Ventas por Nequi (no entra al cajón)" valor={resumen.totalNequi} atenuado />
            <Fila etiqueta={`Total vendido (${resumen.cantidadVentas} ventas)`} valor={resumen.totalVentas} atenuado />
          </div>
        </div>

        <div>
          <Label htmlFor="contado">¿Cuánto efectivo hay en el cajón?</Label>
          <Input
            id="contado"
            type="number"
            inputMode="numeric"
            min={0}
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            onBlur={() => contado.trim() !== "" && setRevelado(true)}
            placeholder="Cuenta los billetes y monedas y escribe el total"
            autoFocus
          />
          <p className="mt-1.5 text-xs text-charcoal-400">
            Cuenta primero, escribe después. El sistema te muestra la diferencia cuando termines.
          </p>
        </div>

        {revelado && contado.trim() !== "" && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-2xl p-4",
              diferencia === 0
                ? "bg-olive-50 text-olive-700 dark:bg-olive-900/20 dark:text-olive-200"
                : "bg-ember-50 text-ember-700 dark:bg-ember-900/20 dark:text-ember-300"
            )}
          >
            {diferencia === 0 ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {diferencia === 0
                  ? "Cuadra exacto"
                  : diferencia > 0
                    ? `Sobran ${formatCOP(diferencia)}`
                    : `Faltan ${formatCOP(Math.abs(diferencia))}`}
              </p>
              <p className="mt-0.5 text-xs opacity-80">
                Esperado {formatCOP(resumen.esperadoEfectivo)} · contado {formatCOP(contadoNumero)}
              </p>
              {diferencia !== 0 && (
                <p className="mt-1 text-xs opacity-80">
                  Explica la diferencia en las notas antes de cerrar: es lo único que después permite reconstruir qué pasó.
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="notasCierre">Notas del cierre {diferencia !== 0 && revelado ? "(recomendado)" : "(opcional)"}</Label>
          <Textarea
            id="notasCierre"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: se pagó el domicilio de la tarde sin registrar, un cliente dejó $2.000 de propina..."
          />
        </div>

        <div className="flex gap-3 border-t border-charcoal-100 pt-4 dark:border-charcoal-700">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={cerrar} disabled={cargando}>
            {cargando ? "Cerrando..." : "Cerrar turno"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Fila({ etiqueta, valor, atenuado }: { etiqueta: string; valor: number; atenuado?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", atenuado && "text-charcoal-400")}>
      <span className={atenuado ? "" : "text-charcoal-500 dark:text-charcoal-300"}>{etiqueta}</span>
      <span className="font-mono font-semibold text-charcoal-900 dark:text-cream">{formatCOP(valor)}</span>
    </div>
  );
}
