"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Check, TriangleAlert, ClipboardCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guardarConteoItem, aplicarConteo } from "@/actions/admin/conteo";
import { UNIDAD_LABEL, formatCosto, redondearCantidad } from "@/lib/costos";
import type { ConteoInventario, ConteoItem, Insumo } from "@prisma/client";

type ItemConInsumo = ConteoItem & { insumo: Insumo };

export function ConteoManager({
  conteo,
  items,
}: {
  conteo: ConteoInventario;
  items: ItemConInsumo[];
}) {
  const router = useRouter();
  const aplicado = conteo.estado === "APLICADO";

  // A ciegas por defecto: ver "1.000 g" antes de contar hace que la cabeza
  // escriba 1.000. Es un sesgo conocido y arruina el propósito del conteo, así
  // que lo esperado se oculta hasta que hay una cifra anotada.
  const [aCiegas, setACiegas] = React.useState(!aplicado);
  const [filtro, setFiltro] = React.useState("");
  const [soloPendientes, setSoloPendientes] = React.useState(false);
  const [aplicando, setAplicando] = React.useState(false);

  const visibles = items.filter((i) => {
    if (soloPendientes && i.stockContado !== null) return false;
    if (!filtro.trim()) return true;
    return i.insumo.nombre.toLowerCase().includes(filtro.trim().toLowerCase());
  });

  const contados = items.filter((i) => i.stockContado !== null);
  const diferencias = contados
    .map((i) => ({ item: i, delta: (i.stockContado as number) - i.stockSistema }))
    .filter((d) => d.delta !== 0);

  const valorFaltante = diferencias.filter((d) => d.delta < 0).reduce((s, d) => s + Math.abs(d.delta) * d.item.costoUnitario, 0);
  const valorSobrante = diferencias.filter((d) => d.delta > 0).reduce((s, d) => s + d.delta * d.item.costoUnitario, 0);

  const guardar = async (item: ItemConInsumo, valor: string) => {
    const limpio = valor.trim();
    const nuevo = limpio === "" ? null : Number(limpio);
    if (nuevo !== null && (Number.isNaN(nuevo) || nuevo < 0)) {
      toast.error("Escribe una cantidad válida");
      router.refresh();
      return;
    }
    if (nuevo === item.stockContado) return;

    const result = await guardarConteoItem({ itemId: item.id, stockContado: nuevo });
    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    router.refresh();
  };

  const handleAplicar = async () => {
    const resumen =
      diferencias.length === 0
        ? "No hay diferencias: el inventario cuadra exacto."
        : `Se van a ajustar ${diferencias.length} insumo(s). Faltante ${formatCosto(valorFaltante)}, sobrante ${formatCosto(valorSobrante)}.`;
    if (!confirm(`${resumen}\n\nEsto mueve el stock y no se puede deshacer. ¿Aplicar?`)) return;

    setAplicando(true);
    const result = await aplicarConteo(conteo.id);
    setAplicando(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`Conteo aplicado — ${result.data?.ajustes ?? 0} ajuste(s) registrados`);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {/* ── Resumen ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta label="Contados" valor={`${contados.length} de ${items.length}`} />
        <Tarjeta label="Con diferencia" valor={String(diferencias.length)} />
        <Tarjeta label="Faltante" valor={formatCosto(valorFaltante)} tono={valorFaltante > 0 ? "malo" : undefined} />
        <Tarjeta label="Sobrante" valor={formatCosto(valorSobrante)} />
      </div>

      {valorFaltante > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Hay <strong>{formatCosto(valorFaltante)}</strong> de insumo que el sistema esperaba y no apareció. Eso es
            porción de más, desperdicio no reportado, o algo que se dañó. Al aplicar el conteo entra como pérdida al
            estado de resultados.
          </p>
        </div>
      )}

      {/* ── Controles ───────────────────────────────────────────────────── */}
      {!aplicado && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar insumo…"
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal-600 dark:text-charcoal-200">
            <input
              type="checkbox"
              checked={soloPendientes}
              onChange={(e) => setSoloPendientes(e.target.checked)}
              className="h-4 w-4 accent-ember-600"
            />
            Solo sin contar
          </label>
          <Button variant="ghost" onClick={() => setACiegas((v) => !v)}>
            {aCiegas ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {aCiegas ? "A ciegas" : "Mostrando lo esperado"}
          </Button>
        </div>
      )}

      {aCiegas && !aplicado && (
        <p className="text-xs text-charcoal-400">
          Cuenta sin ver lo que el sistema espera — si lo ves antes, la cabeza tiende a escribir ese número. La
          diferencia aparece apenas anotas la cantidad.
        </p>
      )}

      {/* ── Tabla ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-4 py-3">Insumo</th>
              <th className="px-4 py-3">Contado</th>
              <th className="px-4 py-3">Esperado</th>
              <th className="px-4 py-3">Diferencia</th>
              <th className="px-4 py-3">En plata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {visibles.map((item) => {
              const contado = item.stockContado;
              const yaContado = contado !== null;
              const delta = yaContado ? contado - item.stockSistema : 0;
              // Lo esperado se revela cuando ya hay cifra anotada: a esa altura
              // el sesgo ya no aplica y ver el número es lo útil.
              const revelar = !aCiegas || yaContado;
              const unidad = UNIDAD_LABEL[item.insumo.unidad];

              return (
                <tr key={item.id} className="bg-white dark:bg-charcoal-800">
                  <td className="px-4 py-2.5 font-medium text-charcoal-900 dark:text-cream">{item.insumo.nombre}</td>
                  <td className="px-4 py-2.5">
                    {aplicado ? (
                      <span className="font-mono">
                        {yaContado ? `${redondearCantidad(contado)} ${unidad}` : "—"}
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          key={`${item.id}-${contado ?? "vacio"}`}
                          type="number"
                          step="any"
                          min={0}
                          defaultValue={contado ?? ""}
                          onBlur={(e) => guardar(item, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="—"
                          className="w-24 rounded-lg border border-charcoal-200 bg-transparent px-2 py-1 text-sm focus:border-ember-500 focus:outline-none dark:border-charcoal-600 dark:text-cream"
                        />
                        <span className="text-xs text-charcoal-400">{unidad}</span>
                        {yaContado && <Check className="h-3.5 w-3.5 text-olive-500" />}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-charcoal-400">
                    {revelar ? `${redondearCantidad(item.stockSistema)} ${unidad}` : "•••"}
                  </td>
                  <td className="px-4 py-2.5 font-mono">
                    {yaContado && delta !== 0 ? (
                      <span className={delta < 0 ? "font-semibold text-red-600 dark:text-red-400" : "font-semibold text-olive-600 dark:text-olive-400"}>
                        {delta > 0 ? "+" : ""}
                        {redondearCantidad(delta)} {unidad}
                      </span>
                    ) : yaContado ? (
                      <span className="text-olive-600 dark:text-olive-400">cuadra</span>
                    ) : (
                      <span className="text-charcoal-300 dark:text-charcoal-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono">
                    {yaContado && delta !== 0 ? (
                      <span className={delta < 0 ? "text-red-600 dark:text-red-400" : "text-charcoal-500 dark:text-charcoal-300"}>
                        {delta < 0 ? "−" : "+"}
                        {formatCosto(Math.abs(delta) * item.costoUnitario)}
                      </span>
                    ) : (
                      <span className="text-charcoal-300 dark:text-charcoal-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-charcoal-400">
                  {soloPendientes ? "Ya contaste todos los insumos que coinciden con el filtro." : "Ningún insumo coincide."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!aplicado && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-charcoal-50 px-4 py-3 dark:bg-charcoal-900/40">
          <p className="text-sm text-charcoal-500 dark:text-charcoal-300">
            Los insumos que dejes en blanco no se ajustan. Puedes contar por tandas y volver después.
          </p>
          <Button onClick={handleAplicar} disabled={aplicando || contados.length === 0}>
            <ClipboardCheck className="h-4 w-4" />
            {aplicando ? "Aplicando..." : "Aplicar conteo"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ label, valor, tono }: { label: string; valor: string; tono?: "malo" }) {
  return (
    <div
      className={`rounded-xl p-3 ${
        tono === "malo" ? "bg-red-50 dark:bg-red-900/20" : "bg-charcoal-50 dark:bg-charcoal-900/40"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-charcoal-400">{label}</p>
      <p
        className={`mt-1 font-display text-xl ${
          tono === "malo" ? "text-red-600 dark:text-red-400" : "text-charcoal-900 dark:text-cream"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
