"use client";

import { Printer, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/utils";

export type LineaTicket = {
  nombre: string;
  cantidad: number;
  total: number;
  extras: string[];
  notas?: string;
};

export type DatosTicket = {
  orderId: string;
  fecha: Date;
  clienteNombre?: string;
  lineas: LineaTicket[];
  subtotal: number;
  descuento: number;
  total: number;
  efectivo: number;
  nequi: number;
  recibido: number;
  cambio: number;
};

/**
 * Recibo de la venta recién cobrada. Está pensado para una impresora térmica de
 * 58/80mm: por eso el ancho fijo en milímetros y la fuente monoespaciada, y por
 * eso el bloque `@media print` esconde TODO lo demás de la página — sin eso, al
 * imprimir salían también el menú del admin y el fondo oscuro, gastando media
 * hoja por venta.
 */
export function TicketVenta({ datos, onClose }: { datos: DatosTicket; onClose: () => void }) {
  const codigo = datos.orderId.slice(-6).toUpperCase();

  return (
    <Modal open onClose={onClose} title="Venta registrada" description={`Ticket ${codigo}`}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #ticket-imprimible, #ticket-imprimible * { visibility: visible !important; }
          #ticket-imprimible {
            position: absolute; left: 0; top: 0;
            width: 72mm; margin: 0; padding: 0;
            color: #000; background: #fff;
          }
          @page { margin: 4mm; }
        }
      `}</style>

      <div className="space-y-5">
        {datos.cambio > 0 && (
          <div className="flex items-center justify-between rounded-2xl bg-olive-50 px-5 py-4 dark:bg-olive-900/20">
            <div className="flex items-center gap-2 text-olive-700 dark:text-olive-200">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-semibold">Devuélvele</span>
            </div>
            <span className="font-display text-3xl text-olive-700 dark:text-olive-200">{formatCOP(datos.cambio)}</span>
          </div>
        )}

        <div
          id="ticket-imprimible"
          className="mx-auto max-w-[72mm] rounded-xl border border-charcoal-200 bg-white p-4 font-mono text-[11px] leading-snug text-charcoal-900 dark:border-charcoal-600"
        >
          <div className="text-center">
            <p className="text-sm font-bold tracking-widest">LA MORDIDA</p>
            <p className="mt-0.5">Ticket {codigo}</p>
            <p>
              {new Intl.DateTimeFormat("es-CO", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(datos.fecha)}
            </p>
            {datos.clienteNombre && <p className="mt-0.5">Cliente: {datos.clienteNombre}</p>}
          </div>

          <Separador />

          {datos.lineas.map((linea, i) => (
            <div key={i} className="mb-1">
              <div className="flex justify-between gap-2">
                <span className="flex-1">
                  {linea.cantidad}× {linea.nombre}
                </span>
                <span>{formatCOP(linea.total)}</span>
              </div>
              {linea.extras.length > 0 && <p className="pl-3 opacity-70">+ {linea.extras.join(", ")}</p>}
              {linea.notas && <p className="pl-3 opacity-70">* {linea.notas}</p>}
            </div>
          ))}

          <Separador />

          <FilaTicket etiqueta="Subtotal" valor={datos.subtotal} />
          {datos.descuento > 0 && <FilaTicket etiqueta="Descuento" valor={-datos.descuento} />}
          <div className="mt-1 flex justify-between text-sm font-bold">
            <span>TOTAL</span>
            <span>{formatCOP(datos.total)}</span>
          </div>

          <Separador />

          {datos.efectivo > 0 && <FilaTicket etiqueta="Efectivo" valor={datos.efectivo} />}
          {datos.nequi > 0 && <FilaTicket etiqueta="Nequi" valor={datos.nequi} />}
          {datos.cambio > 0 && (
            <>
              <FilaTicket etiqueta="Recibido" valor={datos.recibido} />
              <FilaTicket etiqueta="Cambio" valor={datos.cambio} />
            </>
          )}

          <Separador />
          <p className="text-center">¡Gracias por tu mordida!</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Siguiente venta
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Separador() {
  return <p className="my-2 overflow-hidden whitespace-nowrap opacity-50">{"-".repeat(48)}</p>;
}

function FilaTicket({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="flex justify-between">
      <span>{etiqueta}</span>
      <span>{formatCOP(valor)}</span>
    </div>
  );
}
