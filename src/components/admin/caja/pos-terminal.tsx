"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  History,
  LockKeyhole,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP, cn } from "@/lib/utils";
import { totalLinea } from "@/types/caja";
import type { CupoRetiros } from "@/lib/retiros";
import type { CategoriaPOS, ClientePOS, LineaCarrito, ProductoPOS, SesionCajaActiva } from "@/types/caja";
import { CobroModal } from "./cobro-modal";
import { CierreCajaModal } from "./cierre-caja-modal";
import { MovimientoCajaModal } from "./movimiento-caja-modal";
import { RetiroSocioModal } from "./retiro-socio-modal";
import { TicketVenta, type DatosTicket } from "./ticket-venta";
import { VentasDelTurno, type VentaResumida } from "./ventas-del-turno";

export function PosTerminal({
  sesion,
  catalogo,
  ventas,
  cupo,
  clientes,
}: {
  sesion: SesionCajaActiva;
  catalogo: CategoriaPOS[];
  ventas: VentaResumida[];
  cupo: CupoRetiros;
  clientes: ClientePOS[];
}) {
  const router = useRouter();

  const [busqueda, setBusqueda] = React.useState("");
  const [categoriaId, setCategoriaId] = React.useState<string>("todas");
  const [lineas, setLineas] = React.useState<LineaCarrito[]>([]);
  const [descuento, setDescuento] = React.useState("");
  const [lineaConNota, setLineaConNota] = React.useState<string | null>(null);

  const [cobrando, setCobrando] = React.useState(false);
  const [cerrando, setCerrando] = React.useState(false);
  const [movimiento, setMovimiento] = React.useState<"INGRESO" | "EGRESO" | null>(null);
  const [retirando, setRetirando] = React.useState(false);
  const [ticket, setTicket] = React.useState<DatosTicket | null>(null);

  const buscadorRef = React.useRef<HTMLInputElement>(null);

  const productos = React.useMemo(() => {
    const deCategoria = categoriaId === "todas" ? catalogo.flatMap((c) => c.productos) : (catalogo.find((c) => c.id === categoriaId)?.productos ?? []);

    const termino = normalizar(busqueda.trim());
    if (!termino) return deCategoria;
    return deCategoria.filter((p) => normalizar(p.name).includes(termino));
  }, [catalogo, categoriaId, busqueda]);

  const agregar = (producto: ProductoPOS) => {
    setLineas((prev) => {
      // Si el mismo producto ya está en el carrito "limpio" (sin extras ni
      // notas), se suma cantidad en vez de abrir otra línea: en el mostrador
      // pedir "tres clásicas" es lo normal y no debería llenar la pantalla.
      const existente = prev.find(
        (l) => l.productId === producto.id && l.extrasElegidos.length === 0 && l.notas === ""
      );
      if (existente) {
        return prev.map((l) => (l.key === existente.key ? { ...l, cantidad: l.cantidad + 1 } : l));
      }

      return [
        ...prev,
        {
          key: `${producto.id}-${Date.now()}`,
          productId: producto.id,
          nombre: producto.name,
          precioUnitario: producto.price,
          cantidad: 1,
          extrasDisponibles: producto.extras,
          extrasElegidos: [],
          notas: "",
        },
      ];
    });
  };

  const actualizar = (key: string, cambios: Partial<LineaCarrito>) =>
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...cambios } : l)));

  const quitar = (key: string) => setLineas((prev) => prev.filter((l) => l.key !== key));

  const alternarExtra = (key: string, extraId: string) =>
    setLineas((prev) =>
      prev.map((l) =>
        l.key === key
          ? {
              ...l,
              extrasElegidos: l.extrasElegidos.includes(extraId)
                ? l.extrasElegidos.filter((id) => id !== extraId)
                : [...l.extrasElegidos, extraId],
            }
          : l
      )
    );

  const subtotal = lineas.reduce((suma, l) => suma + totalLinea(l), 0);
  const descuentoNumero = Math.min(Math.max(Number(descuento) || 0, 0), subtotal);
  const total = subtotal - descuentoNumero;

  const limpiarCarrito = () => {
    setLineas([]);
    setDescuento("");
    setLineaConNota(null);
  };

  const alCobrar = (datos: DatosTicket) => {
    setCobrando(false);
    limpiarCarrito();
    setTicket(datos);
    setBusqueda("");
    buscadorRef.current?.focus();
    router.refresh();
  };

  // Enter en el buscador agrega el primer resultado: con un solo teclado se
  // arma un pedido completo sin soltar las manos para usar el mouse.
  const alEnviarBusqueda = (e: React.FormEvent) => {
    e.preventDefault();
    const primero = productos[0];
    if (!primero) return toast.error("Ningún producto coincide con esa búsqueda");
    agregar(primero);
    setBusqueda("");
  };

  return (
    <div className="space-y-5">
      <EncabezadoTurno
        sesion={sesion}
        cupo={cupo}
        onIngreso={() => setMovimiento("INGRESO")}
        onEgreso={() => setMovimiento("EGRESO")}
        onRetiro={() => setRetirando(true)}
        onCerrar={() => setCerrando(true)}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* ── Catálogo ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <form onSubmit={alEnviarBusqueda} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
            <Input
              ref={buscadorRef}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto y presionar Enter para agregarlo..."
              className="pl-11"
              autoFocus
            />
          </form>

          <div className="flex flex-wrap gap-2">
            <ChipCategoria activa={categoriaId === "todas"} onClick={() => setCategoriaId("todas")}>
              Todo
            </ChipCategoria>
            {catalogo.map((c) => (
              <ChipCategoria key={c.id} activa={categoriaId === c.id} onClick={() => setCategoriaId(c.id)}>
                {c.name}
              </ChipCategoria>
            ))}
          </div>

          {productos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-charcoal-200 py-12 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
              No hay productos que coincidan.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {productos.map((producto) => (
                <TarjetaProducto key={producto.id} producto={producto} onClick={() => agregar(producto)} />
              ))}
            </div>
          )}

          <VentasDelTurno ventas={ventas} />
        </div>

        {/* ── Carrito ──────────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-4 lg:h-fit">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col rounded-2xl border border-charcoal-100 bg-white shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800">
            <div className="flex items-center justify-between border-b border-charcoal-100 p-4 dark:border-charcoal-700">
              <h2 className="flex items-center gap-2 font-display text-lg text-charcoal-900 dark:text-cream">
                <ShoppingCart className="h-4 w-4 text-ember-500" /> VENTA
              </h2>
              {lineas.length > 0 && (
                <button onClick={limpiarCarrito} className="text-xs font-medium text-charcoal-400 hover:text-red-500">
                  Vaciar
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {lineas.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-charcoal-400">
                  <ShoppingCart className="h-8 w-8 opacity-40" />
                  Toca un producto para empezar
                </div>
              ) : (
                <div className="space-y-3">
                  {lineas.map((linea) => (
                    <div key={linea.key} className="rounded-xl border border-charcoal-100 p-3 dark:border-charcoal-700">
                      <div className="flex items-start gap-2">
                        <p className="flex-1 text-sm font-semibold leading-tight text-charcoal-900 dark:text-cream">
                          {linea.nombre}
                        </p>
                        <button
                          onClick={() => quitar(linea.key)}
                          aria-label={`Quitar ${linea.nombre}`}
                          className="text-charcoal-300 transition-colors hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-full border border-charcoal-200 px-1 py-0.5 dark:border-charcoal-600">
                          <button
                            onClick={() =>
                              linea.cantidad === 1
                                ? quitar(linea.key)
                                : actualizar(linea.key, { cantidad: linea.cantidad - 1 })
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-charcoal-100 dark:hover:bg-charcoal-700"
                            aria-label="Restar uno"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{linea.cantidad}</span>
                          <button
                            onClick={() => actualizar(linea.key, { cantidad: Math.min(99, linea.cantidad + 1) })}
                            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-charcoal-100 dark:hover:bg-charcoal-700"
                            aria-label="Sumar uno"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => setLineaConNota(lineaConNota === linea.key ? null : linea.key)}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                            linea.notas
                              ? "bg-mustard-100 text-mustard-700 dark:bg-mustard-900/30"
                              : "text-charcoal-300 hover:bg-charcoal-100 dark:hover:bg-charcoal-700"
                          )}
                          aria-label="Nota para cocina"
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                        </button>

                        <span className="font-mono text-sm font-bold text-ember-600">{formatCOP(totalLinea(linea))}</span>
                      </div>

                      {linea.extrasDisponibles.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {linea.extrasDisponibles.map((extra) => (
                            <button
                              key={extra.id}
                              onClick={() => alternarExtra(linea.key, extra.id)}
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                                linea.extrasElegidos.includes(extra.id)
                                  ? "border-ember-500 bg-ember-50 text-ember-700 dark:bg-ember-900/20 dark:text-ember-300"
                                  : "border-charcoal-200 text-charcoal-500 dark:border-charcoal-600 dark:text-charcoal-300"
                              )}
                            >
                              {extra.name}
                              {extra.price > 0 ? ` +${formatCOP(extra.price)}` : ""}
                            </button>
                          ))}
                        </div>
                      )}

                      {lineaConNota === linea.key && (
                        <Input
                          value={linea.notas}
                          onChange={(e) => actualizar(linea.key, { notas: e.target.value })}
                          placeholder="Ej: sin cebolla, término medio..."
                          className="mt-2 h-9 text-xs"
                          autoFocus
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-charcoal-100 p-4 dark:border-charcoal-700">
              <div className="flex items-center justify-between text-sm text-charcoal-500 dark:text-charcoal-300">
                <span>Subtotal</span>
                <span className="font-mono">{formatCOP(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm text-charcoal-500 dark:text-charcoal-300">
                <label htmlFor="descuento" className="shrink-0">
                  Descuento
                </label>
                <Input
                  id="descuento"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={subtotal}
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  placeholder="0"
                  className="h-9 w-28 text-right font-mono text-sm"
                />
              </div>

              <div className="flex items-end justify-between border-t border-charcoal-100 pt-3 dark:border-charcoal-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">Total</span>
                <span className="font-display text-3xl leading-none text-charcoal-900 dark:text-cream">
                  {formatCOP(total)}
                </span>
              </div>

              <Button size="lg" className="w-full" disabled={lineas.length === 0} onClick={() => setCobrando(true)}>
                Cobrar
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {cobrando && (
        <CobroModal
          lineas={lineas}
          subtotal={subtotal}
          descuento={descuentoNumero}
          total={total}
          clientes={clientes}
          onClose={() => setCobrando(false)}
          onCobrado={alCobrar}
        />
      )}

      {cerrando && <CierreCajaModal sesion={sesion} onClose={() => setCerrando(false)} />}

      {movimiento && <MovimientoCajaModal tipo={movimiento} sesion={sesion} onClose={() => setMovimiento(null)} />}

      {retirando && <RetiroSocioModal sesion={sesion} cupo={cupo} onClose={() => setRetirando(false)} />}

      {ticket && <TicketVenta datos={ticket} onClose={() => setTicket(null)} />}
    </div>
  );
}

function EncabezadoTurno({
  sesion,
  cupo,
  onIngreso,
  onEgreso,
  onRetiro,
  onCerrar,
}: {
  sesion: SesionCajaActiva;
  cupo: CupoRetiros;
  onIngreso: () => void;
  onEgreso: () => void;
  onRetiro: () => void;
  onCerrar: () => void;
}) {
  const { resumen } = sesion;

  return (
    <div className="rounded-2xl border border-charcoal-100 bg-white p-4 shadow-premium dark:border-charcoal-700 dark:bg-charcoal-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-olive-400" />
            <h1 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">
              CAJA · {sesion.codigo}
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-charcoal-400">
            Abierta por {sesion.abiertaPor.name ?? sesion.abiertaPor.email ?? "—"} ·{" "}
            {new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(
              new Date(sesion.abiertaAt)
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onIngreso} className="gap-1.5">
            <ArrowDownLeft className="h-4 w-4 text-olive-500" /> Ingreso
          </Button>
          <Button variant="ghost" size="sm" onClick={onEgreso} className="gap-1.5">
            <ArrowUpRight className="h-4 w-4 text-ember-500" /> Egreso
          </Button>
          <Button variant="ghost" size="sm" onClick={onRetiro} className="gap-1.5">
            <HandCoins className="h-4 w-4 text-mustard-500" /> Retiro socio
          </Button>
          <Link href="/admin/caja/sesiones">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <History className="h-4 w-4" /> Turnos
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={onCerrar} className="gap-1.5">
            <LockKeyhole className="h-4 w-4" /> Cerrar caja
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metrica etiqueta="Esperado en cajón" valor={formatCOP(resumen.esperadoEfectivo)} destacado />
        <Metrica etiqueta={`Ventas (${resumen.cantidadVentas})`} valor={formatCOP(resumen.totalVentas)} />
        <Metrica etiqueta="Nequi" valor={formatCOP(resumen.totalNequi)} />
        {/* Gastos y retiros van separados a propósito: pagarle al proveedor es
            un costo de operar, sacar plata para la casa es repartir la
            ganancia. Sumarlos en una sola cifra hace ver el turno más caro. */}
        <Metrica etiqueta="Gastos del turno" valor={formatCOP(resumen.totalEgresos)} />
        {cupo.hayPresupuesto ? (
          <Metrica
            etiqueta={`Cupo del mes (van ${formatCOP(cupo.retirado)})`}
            valor={cupo.exceso > 0 ? `−${formatCOP(cupo.exceso)}` : formatCOP(cupo.saldo)}
            alerta={cupo.exceso > 0}
          />
        ) : (
          <Metrica etiqueta="Retiros del turno" valor={formatCOP(resumen.totalRetiros)} />
        )}
      </div>
    </div>
  );
}

function Metrica({
  etiqueta,
  valor,
  destacado,
  alerta,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
  /** Pinta la cifra en rojo: hoy solo el cupo de retiros cuando se pasaron. */
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        alerta
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
          : destacado
            ? "border-ember-200 bg-ember-50 dark:border-ember-800 dark:bg-ember-900/20"
            : "border-charcoal-100 dark:border-charcoal-700"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-400">{etiqueta}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-lg font-bold",
          alerta
            ? "text-red-600 dark:text-red-400"
            : destacado
              ? "text-ember-600 dark:text-ember-400"
              : "text-charcoal-900 dark:text-cream"
        )}
      >
        {valor}
      </p>
    </div>
  );
}

function ChipCategoria({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        activa
          ? "bg-ember-gradient text-white shadow-glow"
          : "text-charcoal-600 hover:bg-charcoal-100 dark:text-cream dark:hover:bg-charcoal-700/50"
      )}
    >
      {children}
    </button>
  );
}

function TarjetaProducto({ producto, onClick }: { producto: ProductoPOS; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl border border-charcoal-100 bg-white text-left transition-all hover:-translate-y-0.5 hover:border-ember-400 hover:shadow-glow dark:border-charcoal-700 dark:bg-charcoal-800"
    >
      <div className="relative aspect-[4/3] w-full bg-charcoal-50 dark:bg-charcoal-700">
        {producto.image ? (
          <Image
            src={producto.image}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, 200px"
            className={cn("object-cover", !producto.available && "opacity-40 grayscale")}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl">🍔</div>
        )}
        {!producto.available && (
          <span className="absolute left-2 top-2 rounded-full bg-charcoal-900/80 px-2 py-0.5 text-[10px] font-bold uppercase text-cream">
            Agotado en web
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-xs font-semibold leading-tight text-charcoal-900 dark:text-cream">
          {producto.name}
        </p>
        <p className="mt-1 font-mono text-sm font-bold text-ember-600">{formatCOP(producto.price)}</p>
      </div>
    </button>
  );
}

/**
 * Búsqueda sin tildes ni mayúsculas: "clasica" encuentra "La Clásica". El rango
 * se escribe escapado (y no con los caracteres literales) porque son marcas
 * combinantes invisibles: pegadas tal cual en el código, cualquier editor o
 * copy/paste puede recomponerlas y romper el filtro sin dejar rastro visible.
 */
function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
