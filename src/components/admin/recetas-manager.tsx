"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { upsertRecetaItem, deleteRecetaItem } from "@/actions/admin/recetas";
import { upsertComboItem, deleteComboItem, marcarComoCombo } from "@/actions/admin/combos";
import { UNIDAD_LABEL, formatCosto, costoDeProducto, costoDeReceta } from "@/lib/costos";
import type { MotivoSinTasa } from "@/lib/operacion";
import type { ComboItem, Insumo, Product, RecetaItem } from "@prisma/client";

type ProductWithReceta = Product & {
  category: { name: string };
  recetaItems: (RecetaItem & { insumo: Insumo })[];
  comboItems: (ComboItem & {
    producto: Product & { recetaItems: (RecetaItem & { insumo: Insumo })[] };
  })[];
};

export function RecetasManager({
  products,
  insumos,
  tasaOperacion,
  motivoSinTasa,
}: {
  products: ProductWithReceta[];
  insumos: Insumo[];
  /**
   * Qué fracción de cada peso vendido se va en costos fijos. Llega en null
   * cuando no hay con qué dividir el arriendo, o cuando los fijos superan las
   * ventas — en ambos casos no se muestra el reparto, porque un número
   * inventado aquí es peor que ninguno.
   */
  tasaOperacion: number | null;
  motivoSinTasa: MotivoSinTasa | null;
}) {
  const router = useRouter();
  const [productId, setProductId] = React.useState(products[0]?.id ?? "");
  const [nuevoInsumoId, setNuevoInsumoId] = React.useState(insumos[0]?.id ?? "");
  const [cantidad, setCantidad] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  const [nuevoProductoId, setNuevoProductoId] = React.useState("");
  const [cantidadCombo, setCantidadCombo] = React.useState(1);

  const product = products.find((p) => p.id === productId);
  // En un combo el costo suma las recetas de sus componentes; en un producto
  // suelto es solo la suya. costoDeProducto resuelve los dos casos igual que el
  // servidor, para que Recetas y el punto de equilibrio nunca discrepen.
  const costo = product ? costoDeProducto(product) : 0;
  const margen = product ? product.price - costo : 0;
  const margenPct = product && product.price > 0 ? Math.round((margen / product.price) * 100) : 0;

  // El arriendo y la nómina no son parte de la receta: se estiman como una
  // fracción del precio de venta. Por eso van en una tarjeta aparte y no
  // sumados al costo de los insumos.
  const costoOperacion = product && tasaOperacion !== null ? product.price * tasaOperacion : null;
  const utilidad = costoOperacion !== null ? margen - costoOperacion : null;
  const utilidadPct = utilidad !== null && product && product.price > 0 ? Math.round((utilidad / product.price) * 100) : 0;

  const insumosDisponibles = insumos.filter((i) => !product?.recetaItems.some((ri) => ri.insumoId === i.id));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoInsumoId) return toast.error("Elige un insumo");
    setLoading(true);
    const result = await upsertRecetaItem({ productId, insumoId: nuevoInsumoId, cantidad });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Insumo agregado a la receta");
    setCantidad(1);
    router.refresh();
  };

  const handleRemove = async (id: string) => {
    if (!confirm("¿Quitar este insumo de la receta?")) return;
    const result = await deleteRecetaItem(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Insumo quitado de la receta");
    router.refresh();
  };

  // ── Combos ────────────────────────────────────────────────────────────────
  const productosParaCombo = products.filter(
    (p) => p.id !== productId && !p.esCombo && !product?.comboItems.some((ci) => ci.productoId === p.id)
  );

  const handleToggleCombo = async (esCombo: boolean) => {
    if (!product) return;
    if (!esCombo && product.comboItems.length > 0) {
      if (!confirm(`Al dejar de ser combo se quitan los ${product.comboItems.length} producto(s) que lo componen. ¿Seguir?`)) return;
    }
    const result = await marcarComoCombo(product.id, esCombo);
    if (!result.success) return toast.error(result.error);
    toast.success(esCombo ? "Ahora es un combo" : "Ya no es un combo");
    router.refresh();
  };

  const handleAddCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoProductoId) return toast.error("Elige un producto");
    setLoading(true);
    const result = await upsertComboItem({ comboId: productId, productoId: nuevoProductoId, cantidad: cantidadCombo });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Producto agregado al combo");
    setCantidadCombo(1);
    router.refresh();
  };

  const handleRemoveCombo = async (id: string) => {
    if (!confirm("¿Quitar este producto del combo?")) return;
    const result = await deleteComboItem(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Producto quitado del combo");
    router.refresh();
  };

  const handleUpdateCantidadCombo = async (item: ComboItem, nuevaCantidad: number) => {
    if (!nuevaCantidad || nuevaCantidad <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      router.refresh();
      return;
    }
    if (nuevaCantidad === item.cantidad) return;
    const result = await upsertComboItem({
      id: item.id,
      comboId: item.comboId,
      productoId: item.productoId,
      cantidad: nuevaCantidad,
    });
    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Cantidad actualizada");
    router.refresh();
  };

  const handleUpdateCantidad = async (item: RecetaItem, nuevaCantidad: number) => {
    if (!nuevaCantidad || nuevaCantidad <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      router.refresh(); // por si el input quedó en un valor inválido, lo devolvemos al guardado
      return;
    }
    if (nuevaCantidad === item.cantidad) return;
    const result = await upsertRecetaItem({ id: item.id, productId: item.productId, insumoId: item.insumoId, cantidad: nuevaCantidad });
    if (!result.success) {
      toast.error(result.error);
      router.refresh();
      return;
    }
    toast.success("Cantidad actualizada");
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-1">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setProductId(p.id)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
              p.id === productId ? "bg-ember-gradient text-white shadow-glow" : "text-charcoal-700 hover:bg-charcoal-100 dark:text-cream dark:hover:bg-charcoal-700/50"
            }`}
          >
            <span>
              {p.name}
              <span className="block text-xs opacity-70">
                {p.category.name}
                {p.esCombo ? " · combo" : ""}
              </span>
            </span>
            {/* En un combo lo que hay que contar son sus componentes: su receta
                propia suele estar vacía y un 0 haría creer que está sin costear. */}
            <Badge variant={(p.esCombo ? p.comboItems.length : p.recetaItems.length) > 0 ? "olive" : "charcoal"}>
              {p.esCombo ? p.comboItems.length : p.recetaItems.length}
            </Badge>
          </button>
        ))}
      </div>

      {product && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-charcoal-100 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-800">
            <div>
              <p className="font-display text-lg text-charcoal-900 dark:text-cream">
                {product.name}
                {product.esCombo && (
                  <Badge variant="olive" className="ml-2 align-middle">
                    Combo
                  </Badge>
                )}
              </p>
              <p className="text-xs text-charcoal-400">Precio de venta: ${product.price.toLocaleString("es-CO")}</p>
              <label className="mt-1.5 flex items-center gap-2 text-xs text-charcoal-500 dark:text-charcoal-300">
                <input
                  type="checkbox"
                  checked={product.esCombo}
                  onChange={(e) => handleToggleCombo(e.target.checked)}
                  className="h-3.5 w-3.5 accent-ember-600"
                />
                Este producto es un combo (se arma con otros productos del menú)
              </label>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-charcoal-400">Costo en insumos</p>
                <p className="font-semibold text-charcoal-900 dark:text-cream">{formatCosto(costo)}</p>
              </div>
              <div>
                <p className="text-charcoal-400">Margen de contribución</p>
                <p className={`font-semibold ${margen < 0 ? "text-red-500" : "text-olive-600 dark:text-olive-400"}`}>
                  {formatCosto(margen)} ({margenPct}%)
                </p>
              </div>
              {costoOperacion !== null && utilidad !== null && (
                <>
                  <div>
                    <p className="text-charcoal-400">Operación estimada</p>
                    <p className="font-semibold text-charcoal-500 dark:text-charcoal-300">−{formatCosto(costoOperacion)}</p>
                  </div>
                  <div>
                    <p className="text-charcoal-400">Utilidad real</p>
                    <p className={`font-semibold ${utilidad < 0 ? "text-red-500" : "text-olive-600 dark:text-olive-400"}`}>
                      {formatCosto(utilidad)} ({utilidadPct}%)
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {costoOperacion !== null ? (
            <p className="mb-3 text-xs text-charcoal-400">
              La <strong className="text-charcoal-600 dark:text-charcoal-200">operación estimada</strong> es la parte del
              arriendo, los servicios y la nómina que le toca a este plato, repartida según su precio. No es un costo de
              la receta —cambiarla no cambia lo que se pesa en cocina—, sino una forma de ver si el precio alcanza a
              pagar todo. Se configura en la pestaña{" "}
              <Link href="/admin/inventario/costos" className="underline hover:text-ember-500">
                Costos fijos
              </Link>
              .
            </p>
          ) : motivoSinTasa === "BAJO_EQUILIBRIO" ? (
            <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
              Tus costos fijos hoy son mayores que tus ventas, así que repartirlos entre los platos daría un costo más
              alto que el precio de venta — un número que no ayuda a decidir nada. Lo que hay que mirar mientras tanto es
              cuánto falta para el equilibrio, en la pestaña{" "}
              <Link href="/admin/inventario/costos" className="underline hover:text-amber-900 dark:hover:text-amber-100">
                Costos fijos
              </Link>
              .
            </p>
          ) : (
            <p className="mb-3 text-xs text-charcoal-400">
              Para ver cuánto le toca a este plato del arriendo y la nómina, registra tus gastos fijos y tu meta de
              ventas en la pestaña{" "}
              <Link href="/admin/inventario/costos" className="underline hover:text-ember-500">
                Costos fijos
              </Link>
              .
            </p>
          )}

          {product.esCombo && (
            <div className="mb-5">
              <h3 className="mb-1 font-display text-base text-charcoal-900 dark:text-cream">QUÉ LLEVA EL COMBO</h3>
              <p className="mb-3 text-xs text-charcoal-400">
                Elige productos que ya existen en tu menú. El costo sale solo de sus recetas, así que el día que cambies
                la receta de una hamburguesa este combo se actualiza con ella.
              </p>

              <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
                    <tr>
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3">Cantidad</th>
                      <th className="px-4 py-3">Precio suelto</th>
                      <th className="px-4 py-3">Costo en insumos</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
                    {product.comboItems.map((ci) => {
                      const costoComponente = costoDeReceta(ci.producto.recetaItems) * ci.cantidad;
                      return (
                        <tr key={ci.id} className="bg-white dark:bg-charcoal-800">
                          <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">
                            {ci.producto.name}
                            {ci.producto.recetaItems.length === 0 && (
                              <span className="block text-xs font-normal text-amber-600 dark:text-amber-400">
                                sin receta — no descuenta inventario ni suma costo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              key={`${ci.id}-${ci.cantidad}`}
                              type="number"
                              min={1}
                              step={1}
                              defaultValue={ci.cantidad}
                              onBlur={(e) => handleUpdateCantidadCombo(ci, Number(e.target.value))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              }}
                              className="w-20 rounded-lg border border-charcoal-200 bg-transparent px-2 py-1 text-sm focus:border-ember-500 focus:outline-none dark:border-charcoal-600 dark:text-cream"
                            />
                          </td>
                          <td className="px-4 py-3 text-charcoal-400">{formatCosto(ci.producto.price * ci.cantidad)}</td>
                          <td className="px-4 py-3">{formatCosto(costoComponente)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="icon" variant="ghost" onClick={() => handleRemoveCombo(ci.id)} aria-label="Quitar">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                    {product.comboItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-charcoal-400">
                          Este combo todavía no lleva nada. Agrégale productos abajo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {product.comboItems.length > 0 && (
                <p className="mt-2 text-xs text-charcoal-400">
                  Sueltos costarían{" "}
                  <strong className="text-charcoal-600 dark:text-charcoal-200">
                    {formatCosto(product.comboItems.reduce((s, ci) => s + ci.producto.price * ci.cantidad, 0))}
                  </strong>{" "}
                  y el combo se vende en {formatCosto(product.price)} — un descuento de{" "}
                  {formatCosto(
                    product.comboItems.reduce((s, ci) => s + ci.producto.price * ci.cantidad, 0) - product.price
                  )}
                  .
                </p>
              )}

              {productosParaCombo.length > 0 ? (
                <form onSubmit={handleAddCombo} className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-charcoal-200 p-4 dark:border-charcoal-600">
                  <div className="min-w-[200px] flex-1">
                    <label className="mb-1 block text-xs text-charcoal-400">Producto</label>
                    <Select value={nuevoProductoId} onChange={(e) => setNuevoProductoId(e.target.value)}>
                      <option value="">Elige un producto…</option>
                      {productosParaCombo.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCosto(p.price)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-xs text-charcoal-400">Cantidad</label>
                    <Input type="number" min={1} step={1} value={cantidadCombo} onChange={(e) => setCantidadCombo(Number(e.target.value))} />
                  </div>
                  <Button type="submit" disabled={loading}>
                    <Plus className="h-4 w-4" /> Agregar
                  </Button>
                </form>
              ) : (
                <p className="mt-3 text-sm text-charcoal-400">
                  No quedan productos para agregar. Recuerda que un combo no puede llevar otro combo adentro.
                </p>
              )}
            </div>
          )}

          <p className="mb-3 text-xs text-charcoal-400">
            {product.esCombo ? (
              <>
                <strong className="text-charcoal-600 dark:text-charcoal-200">Insumos propios del combo</strong> — solo lo
                que lleva él y no sus componentes, como la bolsa o el empaque. Puede quedar vacío.
              </>
            ) : (
              <>
                Aquí solo defines <strong className="text-charcoal-600 dark:text-charcoal-200">cuánto</strong> lleva cada
                plato. Los precios se editan una sola vez en la pestaña{" "}
                <strong className="text-charcoal-600 dark:text-charcoal-200">Insumos</strong> —y en el caso de los
                elaborados como el aderezo, salen de su composición—; la receta solo los suma según la cantidad.
              </>
            )}
          </p>

          <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
                <tr>
                  <th className="px-4 py-3">Insumo</th>
                  <th className="px-4 py-3">Cantidad</th>
                  <th className="px-4 py-3">Costo unitario</th>
                  <th className="px-4 py-3">Costo parcial</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
                {product.recetaItems.map((item) => (
                  <tr key={item.id} className="bg-white dark:bg-charcoal-800">
                    <td className="px-4 py-3 font-medium text-charcoal-900 dark:text-cream">
                      {item.insumo.nombre}
                      {item.insumo.esElaborado && (
                        <span className="ml-2 align-middle text-[10px] uppercase tracking-wide text-charcoal-400">
                          elaborado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          key={`${item.id}-${item.cantidad}`}
                          type="number"
                          step="any"
                          min={0}
                          defaultValue={item.cantidad}
                          onBlur={(e) => handleUpdateCantidad(item, Number(e.target.value))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="w-20 rounded-lg border border-charcoal-200 bg-transparent px-2 py-1 text-sm focus:border-ember-500 focus:outline-none dark:border-charcoal-600 dark:text-cream"
                        />
                        <span className="text-xs text-charcoal-400">{UNIDAD_LABEL[item.insumo.unidad]}</span>
                      </div>
                    </td>
                    {/* Solo lectura a propósito: el precio tiene un único dueño,
                        la pestaña Insumos. Editarlo también aquí abriría la
                        puerta a que el mismo aderezo valiera distinto en cada
                        hamburguesa. */}
                    <td className="px-4 py-3 text-charcoal-400" title="Se edita en la pestaña Insumos">
                      {formatCosto(item.insumo.costoUnitario)}
                      <span className="text-xs"> / {UNIDAD_LABEL[item.insumo.unidad]}</span>
                    </td>
                    <td className="px-4 py-3">{formatCosto(item.cantidad * item.insumo.costoUnitario)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => handleRemove(item.id)} aria-label="Quitar">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {product.recetaItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-charcoal-400">
                      Este producto todavía no tiene receta. Agrega insumos abajo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {insumosDisponibles.length > 0 ? (
            <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-charcoal-200 p-4 dark:border-charcoal-600">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-charcoal-400">Insumo</label>
                <Select value={nuevoInsumoId} onChange={(e) => setNuevoInsumoId(e.target.value)}>
                  {insumosDisponibles.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({UNIDAD_LABEL[i.unidad]})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-charcoal-400">Cantidad</label>
                <Input type="number" step="any" min={0} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
              </div>
              <Button type="submit" disabled={loading}>
                <Plus className="h-4 w-4" /> Agregar
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-charcoal-400">Todos los insumos activos ya están en esta receta.</p>
          )}
        </div>
      )}
    </div>
  );
}
