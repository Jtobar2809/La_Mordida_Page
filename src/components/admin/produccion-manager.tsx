"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChefHat, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { registrarProduccion } from "@/actions/admin/produccion";
import { formatCOP, formatDateTime, cn } from "@/lib/utils";
import type { Insumo, InsumoComponente, Produccion, UnidadInsumo } from "@prisma/client";

type ElaboradoConComposicion = Insumo & {
  composicion: (InsumoComponente & { insumoBase: Insumo })[];
};

type ProduccionConInsumo = Produccion & {
  insumoElaborado: { nombre: string; unidad: UnidadInsumo };
};

export function ProduccionManager({
  elaborados,
  historial,
}: {
  elaborados: ElaboradoConComposicion[];
  historial: ProduccionConInsumo[];
}) {
  const router = useRouter();
  const [insumoId, setInsumoId] = React.useState(elaborados[0]?.id ?? "");
  const [cantidad, setCantidad] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [cargando, setCargando] = React.useState(false);

  const elegido = elaborados.find((e) => e.id === insumoId);
  const cantidadNumero = Number(cantidad) || 0;

  // Cuánto se puede preparar como máximo con el stock actual: el componente
  // que primero se agota manda. Se calcula aquí (y no solo en el servidor) para
  // avisar mientras se escribe, en vez de fallar al guardar.
  const maximoProducible = React.useMemo(() => {
    if (!elegido || elegido.composicion.length === 0) return 0;
    return Math.min(
      ...elegido.composicion.map((c) => (c.cantidad > 0 ? c.insumoBase.stockActual / c.cantidad : Infinity))
    );
  }, [elegido]);

  const excedeStock = cantidadNumero > maximoProducible;

  const costoEstimado = React.useMemo(() => {
    if (!elegido) return 0;
    return elegido.composicion.reduce((suma, c) => suma + c.cantidad * cantidadNumero * c.insumoBase.costoUnitario, 0);
  }, [elegido, cantidadNumero]);

  const registrar = async () => {
    if (!insumoId) return toast.error("Elige qué insumo preparaste");
    if (cantidadNumero <= 0) return toast.error("Escribe cuánto preparaste");

    setCargando(true);
    try {
      const resultado = await registrarProduccion({ insumoElaboradoId: insumoId, cantidad: cantidadNumero, notas: notas.trim() || undefined });
      if (!resultado.success) return toast.error(resultado.error);

      toast.success("Producción registrada: se descontaron los componentes");
      setCantidad("");
      setNotas("");
      router.refresh();
    } catch (error) {
      console.error("Error al registrar producción:", error);
      toast.error("Ocurrió un error al registrar la producción");
    } finally {
      setCargando(false);
    }
  };

  if (elaborados.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-charcoal-200 py-16 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
        No tienes insumos marcados como elaborados. Marca uno como &quot;elaborado&quot; en la pestaña Insumos y define su
        composición para poder registrar producciones.
      </p>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
      <div className="space-y-4 rounded-2xl border border-charcoal-100 bg-white p-5 shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800">
        <h2 className="flex items-center gap-2 font-display text-lg text-charcoal-900 dark:text-cream">
          <ChefHat className="h-4 w-4 text-ember-500" /> REGISTRAR PREPARACIÓN
        </h2>

        <div>
          <Label htmlFor="insumoElaborado">¿Qué preparaste?</Label>
          <Select id="insumoElaborado" value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>
            {elaborados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="cantidadProducida">
            ¿Cuánto? ({elegido?.unidad.toLowerCase() ?? "unidad"})
          </Label>
          <Input
            id="cantidadProducida"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="Ej: 2000"
          />
          <p className={cn("mt-1.5 text-xs", excedeStock ? "font-semibold text-red-600" : "text-charcoal-400")}>
            Con el stock actual puedes preparar hasta {redondear(maximoProducible)} {elegido?.unidad.toLowerCase()}.
          </p>
        </div>

        {elegido && elegido.composicion.length > 0 && cantidadNumero > 0 && (
          <div className="rounded-xl border border-charcoal-100 p-3 text-sm dark:border-charcoal-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">Se descontará</p>
            <div className="space-y-1">
              {elegido.composicion.map((c) => {
                const necesario = c.cantidad * cantidadNumero;
                const alcanza = necesario <= c.insumoBase.stockActual;
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2">
                    <span className={cn("truncate", alcanza ? "text-charcoal-600 dark:text-charcoal-200" : "text-red-600")}>
                      {!alcanza && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                      {c.insumoBase.nombre}
                    </span>
                    <span className="shrink-0 font-mono text-xs">
                      {redondear(necesario)} / {redondear(c.insumoBase.stockActual)} {c.insumoBase.unidad.toLowerCase()}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between border-t border-charcoal-100 pt-2 dark:border-charcoal-700">
              <span className="text-charcoal-500 dark:text-charcoal-300">Costo del lote</span>
              <span className="font-mono font-bold text-charcoal-900 dark:text-cream">{formatCOP(costoEstimado)}</span>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="notasProduccion">Notas (opcional)</Label>
          <Textarea
            id="notasProduccion"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej: tanda de la mañana"
          />
        </div>

        <Button onClick={registrar} disabled={cargando || excedeStock || cantidadNumero <= 0} className="w-full">
          {cargando ? "Registrando..." : "Registrar producción"}
        </Button>
      </div>

      <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
          Últimas preparaciones
        </h2>

        {historial.length === 0 ? (
          <p className="py-12 text-center text-sm text-charcoal-400">Todavía no has registrado ninguna preparación.</p>
        ) : (
          <div className="divide-y divide-charcoal-50 dark:divide-charcoal-700/50">
            {historial.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-charcoal-900 dark:text-cream">{p.insumoElaborado.nombre}</p>
                  <p className="text-xs text-charcoal-400">
                    {formatDateTime(p.createdAt)}
                    {p.notas ? ` · ${p.notas}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-charcoal-600 dark:text-charcoal-200">
                  {redondear(p.cantidad)} {p.insumoElaborado.unidad.toLowerCase()}
                </span>
                <span className="hidden shrink-0 font-mono text-xs text-charcoal-400 sm:inline">
                  {formatCOP(p.costoUnitario * p.cantidad)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function redondear(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
