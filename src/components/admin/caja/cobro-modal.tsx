"use client";

import * as React from "react";
import { toast } from "sonner";
import { Banknote, Smartphone, Split } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cobrarVenta } from "@/actions/admin/caja";
import { formatCOP, cn } from "@/lib/utils";
import { totalLinea } from "@/types/caja";
import type { ClientePOS, LineaCarrito } from "@/types/caja";
import type { DatosTicket } from "./ticket-venta";

type Modo = "EFECTIVO" | "NEQUI" | "MIXTO";

/** Billetes con los que realmente paga la gente, para no teclear el recibido. */
const BILLETES = [10_000, 20_000, 50_000, 100_000];

export function CobroModal({
  lineas,
  subtotal,
  descuento,
  total,
  clientes,
  onClose,
  onCobrado,
}: {
  lineas: LineaCarrito[];
  subtotal: number;
  descuento: number;
  total: number;
  clientes: ClientePOS[];
  onClose: () => void;
  onCobrado: (datos: DatosTicket) => void;
}) {
  const [modo, setModo] = React.useState<Modo>("EFECTIVO");
  const [recibido, setRecibido] = React.useState("");
  const [efectivoMixto, setEfectivoMixto] = React.useState("");
  // Vacío = venta de mostrador, que es el caso normal. Solo cuando se elige a
  // alguien la venta queda a su nombre y aparece en su historial de Pedidos.
  const [clienteId, setClienteId] = React.useState("");
  const [buscaCliente, setBuscaCliente] = React.useState("");
  const [cargando, setCargando] = React.useState(false);

  const clienteElegido = clientes.find((c) => c.id === clienteId) ?? null;

  // Se busca por nombre y por teléfono: en el mostrador la cajera casi siempre
  // tiene a mano el número del domicilio anterior, no el nombre escrito igual
  // que en la base. El tope de 6 es para que la lista no empuje los botones de
  // cobrar fuera de la pantalla del celular.
  const terminoCliente = buscaCliente.trim().toLowerCase();
  const coincidencias = terminoCliente
    ? clientes.filter(
        (c) =>
          (c.name ?? "").toLowerCase().includes(terminoCliente) || (c.phone ?? "").includes(terminoCliente)
      )
    : clientes;
  const visibles = coincidencias.slice(0, 6);

  // Cuánto de la venta se paga en efectivo según el modo elegido.
  const parteEfectivo =
    modo === "EFECTIVO" ? total : modo === "MIXTO" ? Math.min(Math.max(Number(efectivoMixto) || 0, 0), total) : 0;
  const parteNequi = total - parteEfectivo;

  const recibidoNumero = Number(recibido) || 0;
  const cambio = parteEfectivo > 0 && recibidoNumero > parteEfectivo ? recibidoNumero - parteEfectivo : 0;
  const faltaEfectivo = parteEfectivo > 0 && recibido !== "" && recibidoNumero < parteEfectivo;

  const cobrar = async () => {
    if (faltaEfectivo) return toast.error("El efectivo recibido es menor a lo que se paga en efectivo");
    if (modo === "MIXTO" && parteEfectivo <= 0) return toast.error("En pago mixto, escribe cuánto pagó en efectivo");

    const pagos = [
      ...(parteEfectivo > 0 ? [{ metodo: "EFECTIVO" as const, monto: parteEfectivo }] : []),
      ...(parteNequi > 0 ? [{ metodo: "NEQUI" as const, monto: parteNequi }] : []),
    ];

    setCargando(true);
    try {
      const resultado = await cobrarVenta({
        items: lineas.map((l) => ({
          productId: l.productId,
          quantity: l.cantidad,
          extraIds: l.extrasElegidos,
          notes: l.notas.trim() || undefined,
        })),
        pagos,
        descuento,
        efectivoRecibido: parteEfectivo > 0 ? Math.max(recibidoNumero, parteEfectivo) : undefined,
        clienteId: clienteId || undefined,
      });

      if (!resultado.success) return toast.error(resultado.error);

      toast.success(resultado.data.cambio > 0 ? `Cobrado — cambio ${formatCOP(resultado.data.cambio)}` : "Venta cobrada");

      onCobrado({
        orderId: resultado.data.orderId,
        fecha: new Date(),
        clienteNombre: clienteElegido?.name ?? undefined,
        // Se congela una copia del carrito para el ticket: el estado del POS se
        // vacía inmediatamente después de cobrar y el recibo debe seguir
        // mostrando lo que se acaba de vender.
        lineas: lineas.map((l) => ({
          nombre: l.nombre,
          cantidad: l.cantidad,
          total: totalLinea(l),
          extras: l.extrasDisponibles.filter((e) => l.extrasElegidos.includes(e.id)).map((e) => e.name),
          notas: l.notas.trim() || undefined,
        })),
        subtotal,
        descuento,
        total: resultado.data.total,
        efectivo: parteEfectivo,
        nequi: parteNequi,
        recibido: parteEfectivo > 0 ? Math.max(recibidoNumero, parteEfectivo) : 0,
        cambio: resultado.data.cambio,
      });
    } catch (error) {
      console.error("Error al cobrar:", error);
      toast.error("Ocurrió un error al cobrar");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Cobrar" description={`${lineas.length} producto(s) en la venta`}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-ember-gradient p-5 text-center text-white shadow-glow">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Total a cobrar</p>
          <p className="font-display text-4xl leading-tight">{formatCOP(total)}</p>
          {descuento > 0 && (
            <p className="mt-1 text-xs opacity-80">
              Subtotal {formatCOP(subtotal)} − descuento {formatCOP(descuento)}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">¿Cómo paga?</p>
          <div className="grid grid-cols-3 gap-2">
            <BotonModo activo={modo === "EFECTIVO"} onClick={() => setModo("EFECTIVO")} icono={Banknote} etiqueta="Efectivo" />
            <BotonModo activo={modo === "NEQUI"} onClick={() => setModo("NEQUI")} icono={Smartphone} etiqueta="Nequi" />
            <BotonModo activo={modo === "MIXTO"} onClick={() => setModo("MIXTO")} icono={Split} etiqueta="Mixto" />
          </div>
        </div>

        {modo === "MIXTO" && (
          <div className="rounded-xl border border-charcoal-100 p-4 dark:border-charcoal-700">
            <Label htmlFor="efectivoMixto">¿Cuánto paga en efectivo?</Label>
            <Input
              id="efectivoMixto"
              type="number"
              inputMode="numeric"
              min={0}
              max={total}
              value={efectivoMixto}
              onChange={(e) => setEfectivoMixto(e.target.value)}
              placeholder="0"
              autoFocus
            />
            <p className="mt-2 text-sm text-charcoal-500 dark:text-charcoal-300">
              Por Nequi: <span className="font-mono font-bold text-charcoal-900 dark:text-cream">{formatCOP(parteNequi)}</span>
            </p>
          </div>
        )}

        {parteEfectivo > 0 && (
          <div className="rounded-xl border border-charcoal-100 p-4 dark:border-charcoal-700">
            <Label htmlFor="recibido">¿Con cuánto paga? (opcional)</Label>
            <Input
              id="recibido"
              type="number"
              inputMode="numeric"
              min={0}
              value={recibido}
              onChange={(e) => setRecibido(e.target.value)}
              placeholder={String(parteEfectivo)}
              autoFocus={modo === "EFECTIVO"}
            />

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRecibido(String(parteEfectivo))}
                className="rounded-full border border-charcoal-200 px-3 py-1 text-xs font-medium text-charcoal-600 hover:border-ember-500 hover:text-ember-600 dark:border-charcoal-600 dark:text-charcoal-200"
              >
                Exacto
              </button>
              {BILLETES.filter((b) => b > parteEfectivo).map((billete) => (
                <button
                  key={billete}
                  type="button"
                  onClick={() => setRecibido(String(billete))}
                  className="rounded-full border border-charcoal-200 px-3 py-1 text-xs font-medium text-charcoal-600 hover:border-ember-500 hover:text-ember-600 dark:border-charcoal-600 dark:text-charcoal-200"
                >
                  {formatCOP(billete)}
                </button>
              ))}
            </div>

            {faltaEfectivo ? (
              <p className="mt-3 text-sm font-semibold text-red-600">
                Faltan {formatCOP(parteEfectivo - recibidoNumero)}
              </p>
            ) : (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-olive-50 px-4 py-3 dark:bg-olive-900/20">
                <span className="text-sm font-semibold text-olive-700 dark:text-olive-200">Cambio</span>
                <span className="font-display text-2xl text-olive-700 dark:text-olive-200">{formatCOP(cambio)}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="buscaCliente">Cliente (opcional)</Label>

          {clienteElegido ? (
            // Elegido, se colapsa a una sola línea: el buscador ya cumplió y
            // dejarlo abierto solo invita a cambiar por error a quién se le
            // está cobrando.
            <div className="flex items-center justify-between rounded-xl border border-ember-200 bg-ember-50 px-3 py-2 dark:border-ember-800 dark:bg-ember-900/20">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-charcoal-900 dark:text-cream">
                  {clienteElegido.name ?? "Sin nombre"}
                </p>
                {clienteElegido.phone && <p className="text-xs text-charcoal-400">{clienteElegido.phone}</p>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setClienteId("");
                  setBuscaCliente("");
                }}
                className="shrink-0 text-xs font-medium text-ember-600 hover:underline dark:text-ember-400"
              >
                Quitar
              </button>
            </div>
          ) : (
            <>
              <Input
                id="buscaCliente"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Busca por nombre o teléfono"
                autoComplete="off"
              />
              {terminoCliente !== "" && (
                <div className="mt-2 space-y-1">
                  {visibles.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClienteId(c.id)}
                      className="flex w-full items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-charcoal-50 dark:hover:bg-charcoal-700"
                    >
                      <span className="truncate font-medium text-charcoal-900 dark:text-cream">
                        {c.name ?? "Sin nombre"}
                      </span>
                      {c.phone && <span className="shrink-0 text-xs text-charcoal-400">{c.phone}</span>}
                    </button>
                  ))}
                  {visibles.length === 0 && (
                    <p className="px-3 py-2 text-sm text-charcoal-400">Ningún cliente registrado coincide.</p>
                  )}
                  {coincidencias.length > visibles.length && (
                    <p className="px-3 text-xs text-charcoal-400">
                      +{coincidencias.length - visibles.length} más. Escribe un poco más para acotar.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <p className="mt-1 text-xs text-charcoal-400">
            {clienteElegido
              ? `La venta queda a nombre de ${clienteElegido.name ?? "ese cliente"} y aparece en su historial.`
              : "Sin elegir a nadie, la venta queda como mostrador. No suma puntos en ninguno de los dos casos."}
          </p>
        </div>

        <div className="flex gap-3 border-t border-charcoal-100 pt-4 dark:border-charcoal-700">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={cargando}>
            Cancelar
          </Button>
          <Button size="lg" className="flex-[2]" onClick={cobrar} disabled={cargando || faltaEfectivo}>
            {cargando ? "Cobrando..." : `Confirmar ${formatCOP(total)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function BotonModo({
  activo,
  onClick,
  icono: Icono,
  etiqueta,
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ComponentType<{ className?: string }>;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors",
        activo
          ? "border-ember-500 bg-ember-50 text-ember-700 dark:bg-ember-900/20 dark:text-ember-300"
          : "border-charcoal-200 text-charcoal-600 dark:border-charcoal-600 dark:text-charcoal-200"
      )}
    >
      <Icono className="h-5 w-5" />
      {etiqueta}
    </button>
  );
}
