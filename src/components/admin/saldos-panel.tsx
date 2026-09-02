"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, Smartphone, Vault, TriangleAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArqueoNequiModal } from "@/components/admin/arqueo-nequi-modal";
import { guardarSaldoInicialNequi } from "@/actions/admin/nequi";
import { formatCOP, formatDate, cn } from "@/lib/utils";
import type { Saldos } from "@/lib/saldos";

/**
 * El cuadro de "dónde está la plata": cuánto debería haber en el cajón y cuánto
 * en Nequi, ahora mismo.
 *
 * Es la única pantalla de contabilidad SIN mes. Las demás preguntan qué pasó en
 * agosto; esta pregunta qué hay hoy, y mezclar las dos es lo que hace que uno
 * cuente el cajón contra las ventas del mes y no cuadre nunca. Por eso el
 * encabezado lo dice explícito.
 */
export function SaldosPanel({ saldos }: { saldos: Saldos }) {
  const { efectivo, guardado, nequi, total, alertas } = saldos;
  const [arqueando, setArqueando] = React.useState(false);

  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">
            <Vault className="h-4 w-4 text-ember-500" /> DÓNDE ESTÁ LA PLATA
          </h2>
          <p className="mt-0.5 text-xs text-charcoal-400">
            Al día de hoy, no del mes que estás mirando. Es un saldo, no un resultado.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-charcoal-400">Deberías tener en total</p>
          <p className="font-mono text-2xl font-bold text-charcoal-900 dark:text-cream">{formatCOP(total)}</p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[38rem] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-charcoal-400">
              <th className="pb-2 pr-4 font-medium">Medio</th>
              <th className="pb-2 pr-4 text-right font-medium">Venía con</th>
              <th className="pb-2 pr-4 text-right font-medium">Entró</th>
              <th className="pb-2 pr-4 text-right font-medium">Salió</th>
              <th className="pb-2 text-right font-medium">Deberías tener</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-50 dark:divide-charcoal-700/50">
            <Fila
              icono={<Banknote className="h-4 w-4 text-olive-500" />}
              nombre="Efectivo en el cajón"
              nota={
                efectivo.hayTurnoAbierto
                  ? `Turno ${efectivo.turnoCodigo} abierto`
                  : efectivo.turnoCodigo
                    ? `Contado al cerrar ${efectivo.turnoCodigo}`
                    : "Nunca se ha abierto caja"
              }
              // Sin turno abierto no hay "venía con" ni movimientos que mostrar:
              // la cifra es lo que alguien contó al cerrar, y contar le gana a
              // calcular. Poner la base de un turno viejo aquí sugeriría que el
              // cajón sigue moviéndose, y no se está moviendo.
              //
              // La excepción son las salidas que no pasaron por la caja: si se
              // compró la carne con el turno cerrado, el saldo baja y la fila
              // tiene que decir por qué. Sin esa columna el dueño ve una cifra
              // menor a la que contó anoche y ningún renglón que lo explique.
              ancla={efectivo.hayTurnoAbierto ? efectivo.ancla : efectivo.salidasFueraDeCaja > 0 ? efectivo.contado : null}
              entradas={efectivo.hayTurnoAbierto ? efectivo.entradas : null}
              salidas={
                efectivo.hayTurnoAbierto
                  ? efectivo.salidas + efectivo.salidasFueraDeCaja
                  : efectivo.salidasFueraDeCaja > 0
                    ? efectivo.salidasFueraDeCaja
                    : null
              }
              saldo={efectivo.saldo}
            />

            <Fila
              icono={<Vault className="h-4 w-4 text-charcoal-400" />}
              nombre="Efectivo guardado"
              nota={
                guardado.cierres === 0
                  ? "Todavía no hay cierres de los que deducirlo"
                  : `Deducido de ${guardado.cierres} cierre${guardado.cierres === 1 ? "" : "s"}`
              }
              ancla={null}
              entradas={null}
              salidas={null}
              saldo={guardado.monto}
              tenue
            />

            <Fila
              icono={<Smartphone className="h-4 w-4 text-ember-500" />}
              nombre="Nequi"
              nota={
                nequi.ancladoAt
                  ? `Contado el ${formatDate(nequi.ancladoAt)}`
                  : "Desde el saldo inicial · nunca se ha contado"
              }
              ancla={nequi.ancla}
              entradas={nequi.entradas}
              salidas={nequi.salidas + nequi.salidasFueraDeCaja}
              saldo={nequi.saldo}
            />
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-charcoal-200 dark:border-charcoal-600">
              <td colSpan={4} className="pt-3 pr-4 text-right text-xs uppercase tracking-wide text-charcoal-400">
                Total
              </td>
              <td className="pt-3 text-right font-mono text-base font-bold text-charcoal-900 dark:text-cream">
                {formatCOP(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Arqueo del Nequi ────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-charcoal-50 px-4 py-3 dark:bg-charcoal-900/40">
        <div className="min-w-0 text-xs text-charcoal-500 dark:text-charcoal-300">
          {nequi.ancladoAt ? (
            <>
              Último conteo el {formatDate(nequi.ancladoAt)}:{" "}
              {nequi.ultimaDiferencia === 0 ? (
                <span className="font-semibold text-olive-600 dark:text-olive-400">cuadró exacto</span>
              ) : (
                <span
                  className={cn(
                    "font-semibold",
                    (nequi.ultimaDiferencia ?? 0) < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-mustard-700 dark:text-mustard-300"
                  )}
                >
                  {(nequi.ultimaDiferencia ?? 0) < 0 ? "faltaban " : "sobraban "}
                  {formatCOP(Math.abs(nequi.ultimaDiferencia ?? 0))}
                </span>
              )}
              . Desde ahí se cuenta hacia adelante.
            </>
          ) : (
            <>
              El Nequi nunca se ha contado. Mientras no lo hagas, el saldo arranca del punto de partida de abajo — si
              está en cero, la cifra está corrida en exactamente lo que ya había en el celular.
            </>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setArqueando(true)}>
          Contar el Nequi
        </Button>
      </div>

      {/*
        El punto de partida solo se ofrece mientras no exista ningún arqueo.
        Después no se lee más —manda lo contado— y dejar un campo editable que
        ya no mueve nada es peor que no tenerlo.
      */}
      {!nequi.ancladoAt && <SaldoInicialNequi actual={nequi.ancla} />}

      {/* ── Lo que puede estar descuadrando el cuadro ───────────────────── */}
      {alertas.length === 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-olive-50 p-3 text-xs text-olive-800 dark:bg-olive-900/20 dark:text-olive-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Toda la plata que salió pasó por la caja. No hay nada por fuera que descuadre estos saldos.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {alertas.map((a) => (
            <div
              key={a.clave}
              className="flex items-start gap-2 rounded-xl bg-mustard-50 p-3 text-xs text-mustard-900 dark:bg-mustard-900/20 dark:text-mustard-100"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {a.titulo} · <span className="font-mono">{formatCOP(a.monto)}</span>
                </p>
                <p className="mt-0.5 text-mustard-800 dark:text-mustard-200">{a.detalle}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {arqueando && <ArqueoNequiModal esperado={nequi.saldo} onClose={() => setArqueando(false)} />}
    </div>
  );
}

/**
 * Cuánto había en el celular el día que se empezó a llevar la cuenta.
 *
 * Sin esto el saldo de Nequi arrancaría en cero y quedaría corrido para siempre
 * en la plata que ya estaba ahí. Se pide una sola vez: el primer arqueo lo
 * reemplaza y el campo desaparece.
 */
function SaldoInicialNequi({ actual }: { actual: number }) {
  const router = useRouter();
  const [monto, setMonto] = React.useState(String(actual || ""));
  const [cargando, setCargando] = React.useState(false);

  const guardar = async () => {
    setCargando(true);
    try {
      const resultado = await guardarSaldoInicialNequi({ monto: Number(monto || 0) });
      if (!resultado.success) return toast.error(resultado.error);

      toast.success("Punto de partida guardado");
      router.refresh();
    } catch (error) {
      console.error("Error al guardar el saldo inicial de Nequi:", error);
      toast.error("Ocurrió un error al guardar");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-charcoal-200 px-4 py-3 dark:border-charcoal-600">
      <div className="min-w-[12rem] flex-1">
        <Label htmlFor="nequiSaldoInicial" className="text-xs">
          Punto de partida: ¿cuánto hay hoy en el Nequi?
        </Label>
        <Input
          id="nequiSaldoInicial"
          type="number"
          inputMode="numeric"
          min={0}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0"
        />
      </div>
      <Button size="sm" variant="ghost" onClick={guardar} disabled={cargando}>
        {cargando ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}

/**
 * Una fila del cuadro. Las columnas aceptan `null` porque no todas las filas
 * tienen las cuatro: el efectivo guardado se deduce de una resta entre cierres,
 * no de movimientos, y rellenarlo con ceros diría que no entró ni salió nada
 * —que es falso— en vez de decir que no se sabe.
 */
function Fila({
  icono,
  nombre,
  nota,
  ancla,
  entradas,
  salidas,
  saldo,
  tenue = false,
}: {
  icono: React.ReactNode;
  nombre: string;
  nota: string;
  ancla: number | null;
  entradas: number | null;
  salidas: number | null;
  saldo: number;
  tenue?: boolean;
}) {
  return (
    <tr>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          {icono}
          <div className="min-w-0">
            <p className={cn("font-medium", tenue ? "text-charcoal-600 dark:text-charcoal-300" : "text-charcoal-900 dark:text-cream")}>
              {nombre}
            </p>
            <p className="text-xs text-charcoal-400">{nota}</p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4 text-right font-mono text-charcoal-400">{ancla === null ? "—" : formatCOP(ancla)}</td>
      <td className="py-3 pr-4 text-right font-mono text-olive-600 dark:text-olive-400">
        {entradas === null ? "—" : entradas === 0 ? formatCOP(0) : `+${formatCOP(entradas)}`}
      </td>
      <td className="py-3 pr-4 text-right font-mono text-charcoal-500 dark:text-charcoal-300">
        {salidas === null ? "—" : salidas === 0 ? formatCOP(0) : `−${formatCOP(salidas)}`}
      </td>
      <td
        className={cn(
          "py-3 text-right font-mono font-semibold",
          saldo < 0 ? "text-red-600 dark:text-red-400" : "text-charcoal-900 dark:text-cream"
        )}
      >
        {formatCOP(saldo)}
      </td>
    </tr>
  );
}
