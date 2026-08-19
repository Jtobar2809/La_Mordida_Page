"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { abrirCaja } from "@/actions/admin/caja";
import { formatCOP } from "@/lib/utils";

/** Atajos para la base típica del cajón, para no teclear el monto cada mañana. */
const BASES_SUGERIDAS = [50_000, 100_000, 150_000, 200_000];

export function AperturaCaja() {
  const router = useRouter();
  const [montoInicial, setMontoInicial] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [cargando, setCargando] = React.useState(false);

  const abrir = async () => {
    const monto = Number(montoInicial);
    if (!Number.isFinite(monto) || monto < 0) return toast.error("Escribe con cuánta base abre la caja");

    setCargando(true);
    try {
      const resultado = await abrirCaja({ montoInicial: monto, notas: notas.trim() || undefined });
      if (!resultado.success) return toast.error(resultado.error);

      toast.success(`Caja abierta — turno ${resultado.data.codigo}`);
      router.refresh();
    } catch (error) {
      console.error("Error al abrir caja:", error);
      toast.error("Ocurrió un error al abrir la caja");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ember-gradient shadow-glow">
        <Lock className="h-7 w-7 text-white" />
      </div>

      <h1 className="mt-5 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CAJA CERRADA</h1>
      <p className="mt-2 text-sm text-charcoal-500 dark:text-charcoal-300">
        Cuenta el efectivo con el que arranca el cajón y abre el turno. Todas las ventas, gastos y retiros quedarán
        asociados a él hasta que lo cierres.
      </p>

      <div className="mt-8 w-full space-y-4 rounded-2xl border border-charcoal-100 bg-white p-6 text-left shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800">
        <div>
          <Label htmlFor="montoInicial">Base en efectivo</Label>
          <Input
            id="montoInicial"
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            value={montoInicial}
            onChange={(e) => setMontoInicial(e.target.value)}
            placeholder="Ej: 100000"
            autoFocus
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {BASES_SUGERIDAS.map((base) => (
              <button
                key={base}
                type="button"
                onClick={() => setMontoInicial(String(base))}
                className="rounded-full border border-charcoal-200 px-3 py-1 text-xs font-medium text-charcoal-600 transition-colors hover:border-ember-500 hover:text-ember-600 dark:border-charcoal-600 dark:text-charcoal-200"
              >
                {formatCOP(base)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="notasApertura">Notas (opcional)</Label>
          <Textarea
            id="notasApertura"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: turno de la tarde, quedó un billete falso apartado..."
          />
        </div>

        <Button onClick={abrir} disabled={cargando} size="lg" className="w-full">
          {cargando ? "Abriendo..." : "Abrir caja"}
        </Button>
      </div>

      <Link
        href="/admin/caja/sesiones"
        className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-charcoal-500 transition-colors hover:text-ember-600 dark:text-charcoal-300"
      >
        <History className="h-4 w-4" /> Ver turnos anteriores
      </Link>
    </div>
  );
}
