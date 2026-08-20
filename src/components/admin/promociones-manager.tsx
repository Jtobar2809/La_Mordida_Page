"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, TriangleAlert, TrendingUp, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { crearComboDesdeSugerencia } from "@/actions/admin/promociones";
import { formatCosto } from "@/lib/costos";
import {
  generarSugerencias,
  generarPromosMismoProducto,
  ETIQUETA_TIPO,
  type ProductoCosteado,
  type Sugerencia,
  type TipoPromo,
  type SugerenciaMismoProducto,
} from "@/lib/promociones";

const FILTROS: { valor: TipoPromo | "TODOS"; etiqueta: string }[] = [
  { valor: "TODOS", etiqueta: "Todos" },
  { valor: "COMPLETO", etiqueta: "Combo completo" },
  { valor: "PLATO_BEBIDA", etiqueta: "Plato + bebida" },
  { valor: "DOS_PLATOS", etiqueta: "Dos platos" },
];

export function PromocionesManager({
  productos,
  sinCosto,
  categorias,
}: {
  productos: ProductoCosteado[];
  sinCosto: string[];
  categorias: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [seccion, setSeccion] = React.useState<"COMBOS" | "MISMO">("COMBOS");
  // 15% es donde aterrizan los combos que funcionan según la práctica del
  // sector: suficiente para que se sienta oferta, poco para no regalar margen.
  const [descuento, setDescuento] = React.useState(15);
  const [filtro, setFiltro] = React.useState<TipoPromo | "TODOS">("TODOS");
  const [soloSeguros, setSoloSeguros] = React.useState(true);
  const [creando, setCreando] = React.useState<Sugerencia | null>(null);

  const sugerencias = React.useMemo(
    () => generarSugerencias(productos, descuento / 100),
    [productos, descuento]
  );

  // Antes del return temprano: un hook no puede quedar detrás de un `if`.
  const mismoProducto = React.useMemo(() => generarPromosMismoProducto(productos), [productos]);

  const visibles = sugerencias
    .filter((s) => (filtro === "TODOS" ? true : s.tipo === filtro))
    .filter((s) => (soloSeguros ? s.seguro : true));

  const mejor = sugerencias[0];

  if (productos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-charcoal-200 p-10 text-center dark:border-charcoal-600">
        <p className="text-sm text-charcoal-400">
          No hay productos con receta costeada, así que no se puede calcular ninguna promoción sin inventar números.
          Arma las recetas en{" "}
          <Link href="/admin/inventario/recetas" className="underline hover:text-ember-500">
            Inventario › Recetas
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 text-sm">
        {([["COMBOS", "Combos de varios productos"], ["MISMO", "2x1, 3x2 y similares"]] as const).map(([v, etiqueta]) => (
          <button
            key={v}
            onClick={() => setSeccion(v)}
            className={
              seccion === v
                ? "rounded-full bg-charcoal-800 px-4 py-2 font-medium text-white dark:bg-cream dark:text-charcoal-900"
                : "rounded-full px-4 py-2 font-medium text-charcoal-500 hover:bg-charcoal-100 dark:text-charcoal-300 dark:hover:bg-charcoal-700/50"
            }
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {seccion === "MISMO" && <TablaMismoProducto sugerencias={mismoProducto} />}

      {seccion === "COMBOS" && (
      <>
      {/* ── La regla que evita el desastre ──────────────────────────────── */}
      {mejor && (
        <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
          <h2 className="flex items-center gap-2 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">
            <TrendingUp className="h-4 w-4 text-ember-500" /> LA MEJOR QUE PUEDES ARMAR HOY
          </h2>
          <p className="mt-2 text-sm text-charcoal-500 dark:text-charcoal-300">
            <strong className="text-charcoal-900 dark:text-cream">{mejor.productos.map((p) => p.nombre).join(" + ")}</strong>{" "}
            a {formatCosto(mejor.precioSugerido)} en vez de {formatCosto(mejor.precioSuelto)}. Te deja{" "}
            <strong className="text-charcoal-900 dark:text-cream">{formatCosto(mejor.contribucion)}</strong> después de
            insumos.
          </p>
        </div>
      )}

      {/* ── Controles ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-[260px] flex-1">
            <Label htmlFor="descuento">Descuento sobre el precio suelto: {descuento}%</Label>
            <input
              id="descuento"
              type="range"
              min={5}
              max={40}
              step={1}
              value={descuento}
              onChange={(e) => setDescuento(Number(e.target.value))}
              className="mt-2 w-full accent-ember-600"
            />
            <p className="mt-1 text-xs text-charcoal-400">
              Los combos que funcionan suelen estar entre 12% y 18%. Por encima del 20% casi ningún aumento de ventas
              alcanza a reponer lo que regalas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={filtro} onChange={(e) => setFiltro(e.target.value as TipoPromo | "TODOS")} className="w-52">
              {FILTROS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.etiqueta}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-sm text-charcoal-600 dark:text-charcoal-200">
              <input
                type="checkbox"
                checked={soloSeguros}
                onChange={(e) => setSoloSeguros(e.target.checked)}
                className="h-4 w-4 accent-ember-600"
              />
              Solo las seguras
            </label>
          </div>
        </div>
      </div>

      {sinCosto.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>{sinCosto.length} producto(s) quedaron fuera</strong> por no tener receta: {sinCosto.join(", ")}. Sin
            costo aparecerían con margen del 100% y el generador recomendaría con toda confianza justo las peores
            promociones. Costéalos y vuelven a entrar solos.
          </p>
        </div>
      )}

      {/* ── Tabla ───────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-xs text-charcoal-400">
          {visibles.length} de {sugerencias.length} combinaciones. Ordenadas por lo que más plata dejan, no por precio.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
              <tr>
                <th className="px-4 py-3">Combo</th>
                <th className="px-4 py-3">Suelto</th>
                <th className="px-4 py-3">Precio combo</th>
                <th className="px-4 py-3">Te deja</th>
                <th className="px-4 py-3" title="Si el cliente ya compraba todo por separado">
                  Si ya compraba
                </th>
                <th className="px-4 py-3" title="Si solo iba a llevar el plato principal">
                  Si solo llevaba el plato
                </th>
                <th className="px-4 py-3 text-right">Crear</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
              {visibles.map((s) => (
                <tr key={s.id} className="bg-white dark:bg-charcoal-800">
                  <td className="px-4 py-3">
                    <p className="font-medium text-charcoal-900 dark:text-cream">
                      {s.productos.map((p) => p.nombre).join(" + ")}
                    </p>
                    <p className="text-xs text-charcoal-400">
                      {ETIQUETA_TIPO[s.tipo]} · costo {s.costoPct.toFixed(0)}%
                      {s.advertencia && (
                        <span className={s.bajoCosto ? " text-red-600 dark:text-red-400" : " text-amber-600 dark:text-amber-400"}>
                          {" "}
                          · {s.advertencia}
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-charcoal-400 line-through">{formatCosto(s.precioSuelto)}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-charcoal-900 dark:text-cream">
                    {formatCosto(s.precioSugerido)}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className={s.bajoCosto ? "font-semibold text-red-600 dark:text-red-400" : "text-charcoal-900 dark:text-cream"}>
                      {formatCosto(s.contribucion)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-red-600 dark:text-red-400">−{formatCosto(s.perdidaSiYaCompraba)}</span>
                    <span className="block text-xs text-charcoal-400">
                      {Number.isFinite(s.vecesMasVentas)
                        ? `vende ${((s.vecesMasVentas - 1) * 100).toFixed(0)}% más para igualar`
                        : "ningún volumen compensa"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-mono ${
                        s.gananciaSiSoloLlevabaElPlato >= 0
                          ? "text-olive-600 dark:text-olive-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {s.gananciaSiSoloLlevabaElPlato >= 0 ? "+" : "−"}
                      {formatCosto(Math.abs(s.gananciaSiSoloLlevabaElPlato))}
                    </span>
                    <span className="block text-xs text-charcoal-400">contra vender solo el plato</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.bajoCosto ? (
                      <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400">
                        No
                      </Badge>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setCreando(s)}>
                        <Plus className="h-4 w-4" /> Crear
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-charcoal-400">
                    Con {descuento}% de descuento ninguna combinación queda dentro de lo seguro. Baja el descuento o
                    destilda &quot;solo las seguras&quot; para verlas con su advertencia.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-charcoal-50 p-4 text-sm text-charcoal-500 dark:bg-charcoal-900/40 dark:text-charcoal-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>
            <strong>Las dos últimas columnas son la decisión completa.</strong> Un combo no es bueno ni malo por sí
            mismo: depende de a quién se lo vendas.
          </p>
          <p className="mt-1">
            Si se lo das a alguien que ya iba a comprar las tres cosas, le estás regalando el descuento y necesitas
            vender bastante más para quedar igual. Si se lo das a alguien que solo venía por la hamburguesa, le vendiste
            papas y gaseosa que no pensaba llevar — y ahí ganas. Por eso los combos se anuncian a quien está pidiendo un
            plato solo, no a quien ya llenó el carrito.
          </p>
        </div>
      </div>

      </>
      )}

      <Modal open={creando !== null} onClose={() => setCreando(null)} title="Crear este combo">
        {creando && (
          <CrearComboForm
            sugerencia={creando}
            categorias={categorias}
            onDone={() => {
              setCreando(null);
              router.refresh();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function CrearComboForm({
  sugerencia,
  categorias,
  onDone,
}: {
  sugerencia: Sugerencia;
  categorias: { id: string; name: string }[];
  onDone: () => void;
}) {
  const combos = categorias.find((c) => c.name.toLowerCase().includes("combo"));
  const [form, setForm] = React.useState({
    nombre: `Combo ${sugerencia.productos[0]!.nombre}`,
    descripcion: sugerencia.productos.map((p) => p.nombre).join(", ") + ".",
    precio: sugerencia.precioSugerido,
    categoriaId: combos?.id ?? categorias[0]?.id ?? "",
  });
  const [loading, setLoading] = React.useState(false);

  const contribucion = form.precio - sugerencia.costo;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await crearComboDesdeSugerencia({
      ...form,
      productoIds: sugerencia.productos.map((p) => p.id),
      disponible: false,
    });
    setLoading(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Combo creado — queda oculto hasta que lo publiques en Productos");
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-charcoal-50 p-3 text-sm dark:bg-charcoal-900/40">
        <p className="text-charcoal-600 dark:text-charcoal-200">{sugerencia.productos.map((p) => p.nombre).join(" + ")}</p>
        <p className="mt-1 text-xs text-charcoal-400">
          Insumos {formatCosto(sugerencia.costo)} · suelto {formatCosto(sugerencia.precioSuelto)}
        </p>
      </div>

      <div>
        <Label htmlFor="nombre">Nombre en la carta</Label>
        <Input id="nombre" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
      </div>
      <div>
        <Label htmlFor="descripcion">Descripción</Label>
        <Input
          id="descripcion"
          required
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="precio">Precio</Label>
          <Input
            id="precio"
            type="number"
            min={0}
            required
            value={form.precio}
            onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="categoriaId">Categoría</Label>
          <Select
            id="categoriaId"
            value={form.categoriaId}
            onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className={`text-sm ${contribucion <= 0 ? "text-red-600 dark:text-red-400" : "text-charcoal-500 dark:text-charcoal-300"}`}>
        A ese precio te deja <strong>{formatCosto(contribucion)}</strong> después de insumos.
        {contribucion <= 0 && " No cubre ni los insumos."}
      </p>

      <p className="rounded-xl bg-charcoal-50 p-3 text-xs text-charcoal-400 dark:bg-charcoal-900/40">
        <Sparkles className="mr-1 inline h-3 w-3" />
        Nace oculto en la carta. Ponle foto y revísalo en Productos antes de publicarlo — crear un combo desde una tabla
        de análisis es un experimento, y un experimento no debería salirle al cliente sin que alguien lo mire.
      </p>

      <Button type="submit" disabled={loading || contribucion <= 0} className="w-full">
        {loading ? "Creando..." : "Crear combo"}
      </Button>
    </form>
  );
}

/**
 * Las promos del mismo producto (2x1, 3x2, la segunda a mitad).
 *
 * La columna que manda aquí no es el precio: es la holgura entre el costo del
 * producto y el techo que aguanta el formato. Un 2x1 entrega dos y cobra uno,
 * así que solo cabe si el costo está por debajo del 50% — y esa comparación,
 * puesta al lado, explica sola por qué el mismo formato sirve para una
 * hamburguesa y arruina la de al lado.
 */
function TablaMismoProducto({ sugerencias }: { sugerencias: SugerenciaMismoProducto[] }) {
  const [soloViables, setSoloViables] = React.useState(true);
  const visibles = sugerencias.filter((s) => (soloViables ? s.viable : true));
  const descartadas = sugerencias.length - sugerencias.filter((s) => s.viable).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl bg-charcoal-50 p-4 text-sm text-charcoal-500 dark:bg-charcoal-900/40 dark:text-charcoal-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p>
            <strong>Aquí la aritmética es más dura que en un combo.</strong> En un combo el descuento se reparte entre
            productos de costos distintos, y las papas o la gaseosa —baratas y de alto valor percibido— amortiguan. En un
            2x1 entregas el mismo producto caro dos veces: el costo se duplica y el ingreso se queda igual.
          </p>
          <p className="mt-1">
            De ahí sale el techo de cada formato: un <strong>2x1</strong> solo cabe si tu costo está por debajo del 50%;
            un <strong>3x2</strong>, del 67%; <strong>la segunda a mitad</strong>, del 75%.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-charcoal-400">
          {visibles.length} de {sugerencias.length} combinaciones
          {descartadas > 0 && ` · ${descartadas} pierden plata y están ocultas`}
        </p>
        <label className="flex items-center gap-2 text-sm text-charcoal-600 dark:text-charcoal-200">
          <input
            type="checkbox"
            checked={soloViables}
            onChange={(e) => setSoloViables(e.target.checked)}
            className="h-4 w-4 accent-ember-600"
          />
          Ocultar las que pierden plata
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-charcoal-100 dark:border-charcoal-700">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-800">
            <tr>
              <th className="px-4 py-3">Producto y formato</th>
              <th className="px-4 py-3">Paga</th>
              <th className="px-4 py-3">Te deja</th>
              <th className="px-4 py-3">Tu costo vs. el techo</th>
              <th className="px-4 py-3">Si solo llevaba una</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
            {visibles.map((s) => (
              <tr key={s.id} className="bg-white dark:bg-charcoal-800">
                <td className="px-4 py-3">
                  <p className="font-medium text-charcoal-900 dark:text-cream">
                    {s.formato.etiqueta} — {s.producto.nombre}
                  </p>
                  <p className="text-xs text-charcoal-400">
                    Se lleva {s.formato.entregadas} · insumos {formatCosto(s.costo)}
                    {s.advertencia && (
                      <span className={s.viable ? " text-amber-600 dark:text-amber-400" : " text-red-600 dark:text-red-400"}>
                        {" "}
                        · {s.advertencia}
                      </span>
                    )}
                  </p>
                </td>
                <td className="px-4 py-3 font-mono">
                  <span className="font-semibold text-charcoal-900 dark:text-cream">{formatCosto(s.precioPromo)}</span>
                  <span className="block text-xs text-charcoal-400 line-through">{formatCosto(s.precioSuelto)}</span>
                </td>
                <td className="px-4 py-3 font-mono">
                  <span
                    className={
                      s.viable ? "text-charcoal-900 dark:text-cream" : "font-semibold text-red-600 dark:text-red-400"
                    }
                  >
                    {formatCosto(s.contribucion)}
                  </span>
                  <span className="block text-xs text-charcoal-400">
                    una sola deja {formatCosto(s.contribucionUnaSola)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`font-mono ${
                      s.holguraPuntos >= 0 ? "text-olive-600 dark:text-olive-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {s.costoPct.toFixed(0)}% de {s.costoMaximoPct.toFixed(0)}%
                  </span>
                  <span className="block text-xs text-charcoal-400">
                    {s.holguraPuntos >= 0
                      ? `te sobran ${s.holguraPuntos.toFixed(0)} puntos`
                      : `te faltan ${Math.abs(s.holguraPuntos).toFixed(0)} puntos`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`font-mono ${
                      s.gananciaSiSoloLlevabaUna >= 0
                        ? "text-olive-600 dark:text-olive-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {s.gananciaSiSoloLlevabaUna >= 0 ? "+" : "−"}
                    {formatCosto(Math.abs(s.gananciaSiSoloLlevabaUna))}
                  </span>
                  <span className="block text-xs text-charcoal-400">contra venderle una</span>
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-charcoal-400">
                  Ningún formato del mismo producto sale a cuenta con tus costos actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-charcoal-400">
        Estas promos no se crean como producto porque no son un combo: son una regla de cobro. Se anuncian y se aplican
        en caja al momento de vender.
      </p>
    </div>
  );
}
