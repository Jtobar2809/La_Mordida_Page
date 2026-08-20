"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Target, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { upsertCostoFijo, deleteCostoFijo, guardarSupuestos } from "@/actions/admin/costos-fijos";
import { formatCosto } from "@/lib/costos";
import { CATEGORIA_LABEL, type PanoramaOperacion } from "@/lib/operacion";
import type { CostoFijoCategoria } from "@prisma/client";

type CostoFijo = PanoramaOperacion["costosFijos"][number];

const CATEGORIAS: { value: CostoFijoCategoria; label: string }[] = [
  { value: "ARRIENDO", label: "Arriendo" },
  { value: "SERVICIOS", label: "Servicios (agua, luz, gas, internet)" },
  { value: "MANO_DE_OBRA", label: "Mano de obra (nómina fija)" },
  { value: "ADMINISTRATIVO", label: "Administrativo (contador, licencias)" },
  { value: "OTRO", label: "Otro" },
];

const pct = (fraccion: number) => `${(fraccion * 100).toFixed(1)}%`;

export function CostosFijosManager({ panorama }: { panorama: PanoramaOperacion }) {
  const router = useRouter();
  const [editando, setEditando] = React.useState<CostoFijo | null | undefined>(undefined);

  const {
    costosFijos,
    totalFijoMes,
    margenContribucion,
    origenMargen,
    ventasEquilibrio,
    ventasEquilibrioDia,
    pedidosEquilibrioDia,
    ticketPromedio,
    ticketEsReal,
    diasOperacion,
    ventasReferencia,
    ventasSonReales,
    productosSinReceta,
  } = panorama;

  const cubierto = ventasReferencia > 0 && ventasEquilibrio > 0 ? ventasReferencia / ventasEquilibrio : 0;

  const handleDelete = async (costo: CostoFijo) => {
    if (!confirm(`¿Eliminar "${costo.nombre}" de los costos fijos?`)) return;
    const result = await deleteCostoFijo(costo.id);
    if (!result.success) return toast.error(result.error);
    toast.success("Gasto eliminado");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* ── Punto de equilibrio ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
        <h2 className="flex items-center gap-2 font-display text-lg text-charcoal-900 dark:text-cream">
          <Target className="h-4 w-4 text-ember-500" /> PUNTO DE EQUILIBRIO
        </h2>

        {origenMargen === "SIN_DATOS" ? (
          <p className="mt-3 text-sm text-charcoal-400">
            Todavía no se puede calcular: no hay ventas registradas ni productos con receta costeada. Arma al menos una
            receta en la pestaña Recetas.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Dato label="Costos fijos al mes" valor={formatCosto(totalFijoMes)} />
              <Dato
                label="Margen de contribución"
                valor={pct(margenContribucion)}
                nota={origenMargen === "REAL" ? "de tus ventas reales" : "estimado con tus recetas"}
              />
              <Dato
                label="Tienes que vender al mes"
                valor={formatCosto(ventasEquilibrio)}
                destacado
                nota={`${formatCosto(ventasEquilibrioDia)} por día (${diasOperacion} días)`}
              />
              <Dato
                label="Pedidos por día"
                valor={pedidosEquilibrioDia !== null ? Math.ceil(pedidosEquilibrioDia).toString() : "—"}
                nota={
                  ticketPromedio
                    ? `con ticket de ${formatCosto(ticketPromedio)}${ticketEsReal ? " (real)" : " (estimado)"}`
                    : "falta el ticket promedio, abajo"
                }
              />
            </div>

            <p className="mt-4 text-sm text-charcoal-500 dark:text-charcoal-300">
              De cada peso que vendes quedan{" "}
              <strong className="text-charcoal-900 dark:text-cream">{pct(margenContribucion)}</strong> después de pagar
              los insumos. Ese sobrante es el que tiene que cubrir los {formatCosto(totalFijoMes)} de costos fijos, y
              para lograrlo necesitas facturar {formatCosto(ventasEquilibrio)} al mes. Todo lo que vendas por encima de
              ahí es ganancia.
            </p>

            {ventasReferencia > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-charcoal-400">
                  <span>
                    {ventasSonReales ? "Ventas reales del período" : "Tu meta de ventas"}: {formatCosto(ventasReferencia)}
                  </span>
                  <span className={cubierto >= 1 ? "font-semibold text-olive-600 dark:text-olive-400" : "font-semibold text-amber-600"}>
                    {pct(Math.min(cubierto, 2))} del equilibrio
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-charcoal-100 dark:bg-charcoal-700">
                  <div
                    className={`h-full rounded-full ${cubierto >= 1 ? "bg-olive-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(cubierto, 1) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-charcoal-400">
                  {cubierto >= 1
                    ? `Por encima del equilibrio: te quedan ${formatCosto((ventasReferencia - ventasEquilibrio) * margenContribucion)} de utilidad.`
                    : `Te faltan ${formatCosto(ventasEquilibrio - ventasReferencia)} en ventas para no perder.`}
                </p>
              </div>
            )}

            {origenMargen === "RECETAS" && productosSinReceta.length > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  El margen se calculó dejando por fuera {productosSinReceta.length} producto(s) sin receta (
                  {productosSinReceta.slice(0, 4).join(", ")}
                  {productosSinReceta.length > 4 ? "…" : ""}). No es que no cuesten: es que todavía no se sabe cuánto. Si
                  entre ellos hay algo que vendes mucho, este número va a moverse cuando los costees.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Gastos fijos ────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-charcoal-900 dark:text-cream">GASTOS FIJOS DEL MES</h2>
            <p className="text-xs text-charcoal-400">
              Lo que pagas así no vendas nada. Un gasto anual (seguro, licencia) divídelo entre 12 antes de anotarlo.
            </p>
          </div>
          <Button onClick={() => setEditando(null)}>
            <Plus className="h-4 w-4" /> Nuevo gasto
          </Button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
              <tr>
                <th className="px-4 py-3">Gasto</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Monto mensual</th>
                <th className="px-4 py-3">% del total</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
              {costosFijos.map((c) => (
                <tr key={c.id} className="bg-white dark:bg-charcoal-800">
                  <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">
                    {c.nombre}
                    {c.notas && <span className="block text-xs font-normal text-charcoal-400">{c.notas}</span>}
                  </td>
                  <td className="px-4 py-3 text-charcoal-400">{CATEGORIA_LABEL[c.categoria] ?? c.categoria}</td>
                  <td className="px-4 py-3 font-mono">{formatCosto(c.monto)}</td>
                  <td className="px-4 py-3 text-charcoal-400">
                    {totalFijoMes > 0 ? pct(c.monto / totalFijoMes) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditando(c)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(c)} aria-label="Eliminar">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {costosFijos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-charcoal-400">
                    Aún no has registrado gastos fijos.
                  </td>
                </tr>
              )}
            </tbody>
            {costosFijos.length > 0 && (
              <tfoot className="bg-charcoal-50 dark:bg-charcoal-800">
                <tr>
                  <td className="px-4 py-3 font-semibold text-charcoal-900 dark:text-cream" colSpan={2}>
                    Total al mes
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-charcoal-900 dark:text-cream">
                    {formatCosto(totalFijoMes)}
                  </td>
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <SupuestosForm panorama={panorama} />

      <Modal open={editando !== undefined} onClose={() => setEditando(undefined)} title={editando ? "Editar gasto fijo" : "Nuevo gasto fijo"}>
        <CostoFijoForm
          costo={editando ?? null}
          onDone={() => {
            setEditando(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function Dato({ label, valor, nota, destacado }: { label: string; valor: string; nota?: string; destacado?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${destacado ? "bg-ember-50 dark:bg-ember-900/20" : "bg-charcoal-50 dark:bg-charcoal-900/40"}`}>
      <p className="text-xs uppercase tracking-wide text-charcoal-400">{label}</p>
      <p className={`mt-1 font-display text-xl ${destacado ? "text-ember-600 dark:text-ember-400" : "text-charcoal-900 dark:text-cream"}`}>
        {valor}
      </p>
      {nota && <p className="mt-0.5 text-xs text-charcoal-400">{nota}</p>}
    </div>
  );
}

function CostoFijoForm({ costo, onDone }: { costo: CostoFijo | null; onDone: () => void }) {
  const [form, setForm] = React.useState({
    nombre: costo?.nombre ?? "",
    monto: costo?.monto ?? 0,
    categoria: (costo?.categoria ?? "OTRO") as CostoFijoCategoria,
    notas: costo?.notas ?? "",
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await upsertCostoFijo({ id: costo?.id, ...form, activo: true });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success(costo ? "Gasto actualizado" : "Gasto creado");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nombre">Nombre del gasto</Label>
        <Input
          id="nombre"
          required
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Ej: Arriendo del local"
        />
      </div>
      <div>
        <Label htmlFor="categoria">Categoría</Label>
        <Select
          id="categoria"
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value as CostoFijoCategoria })}
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="monto">Monto mensual (COP)</Label>
        <Input
          id="monto"
          type="number"
          min={0}
          value={form.monto}
          onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
          placeholder="Ej: 600000"
        />
      </div>
      <div>
        <Label htmlFor="notas">Notas (opcional)</Label>
        <Input
          id="notas"
          value={form.notas}
          onChange={(e) => setForm({ ...form, notas: e.target.value })}
          placeholder="Ej: incluye administración"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : costo ? "Guardar cambios" : "Crear gasto"}
      </Button>
    </form>
  );
}

function SupuestosForm({ panorama }: { panorama: PanoramaOperacion }) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    ventasEstimadasMes: panorama.ventasSonReales ? 0 : panorama.ventasReferencia,
    ticketPromedioEstimado: panorama.ticketEsReal ? 0 : (panorama.ticketPromedio ?? 0),
    diasOperacionMes: panorama.diasOperacion,
  });
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await guardarSupuestos(form);
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Supuestos guardados");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-dashed border-charcoal-200 p-4 dark:border-charcoal-600">
      <h2 className="font-display text-lg text-charcoal-900 dark:text-cream">SUPUESTOS</h2>
      <p className="mb-3 text-xs text-charcoal-400">
        Se usan solo mientras no haya ventas registradas. En cuanto empiecen a entrar pedidos, el cálculo pasa a usar tus
        datos reales y estos quedan de referencia.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="ventasEstimadasMes">Meta de ventas al mes</Label>
          <Input
            id="ventasEstimadasMes"
            type="number"
            min={0}
            value={form.ventasEstimadasMes}
            onChange={(e) => setForm({ ...form, ventasEstimadasMes: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="ticketPromedioEstimado">Ticket promedio esperado</Label>
          <Input
            id="ticketPromedioEstimado"
            type="number"
            min={0}
            value={form.ticketPromedioEstimado}
            onChange={(e) => setForm({ ...form, ticketPromedioEstimado: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="diasOperacionMes">Días que abres al mes</Label>
          <Input
            id="diasOperacionMes"
            type="number"
            min={1}
            max={31}
            value={form.diasOperacionMes}
            onChange={(e) => setForm({ ...form, diasOperacionMes: Number(e.target.value) })}
          />
        </div>
      </div>
      <Button type="submit" variant="secondary" disabled={loading} className="mt-3">
        {loading ? "Guardando..." : "Guardar supuestos"}
      </Button>
    </form>
  );
}
