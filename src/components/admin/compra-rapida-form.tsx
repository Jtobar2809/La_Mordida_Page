"use client";

import * as React from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { registrarCompra } from "@/actions/admin/compras";
import { METODOS_COMPRA } from "@/components/admin/compra-form";
import { UNIDAD_LABEL, costoPorUnidad, formatCosto, redondearCantidad } from "@/lib/costos";
import type { Insumo, MetodoPago, Proveedor } from "@prisma/client";

/**
 * Registrar de una sola vez la compra de UN insumo: "llegaron 4.000 g, pagué
 * $29.000". Reutiliza `registrarCompra` con una sola línea, así que el stock,
 * el costo promedio y el comprobante salen por el mismo camino que una compra
 * armada a mano — no hay una segunda vía que pueda desviarse.
 *
 * Existe porque el formulario completo (ir a Compras, elegir proveedor, armar
 * varias líneas) es demasiado trámite para un bulto de papas, y esa fricción es
 * la razón de que no hubiera ni una sola compra registrada.
 */
export function CompraRapidaForm({
  insumo,
  proveedores,
  onDone,
}: {
  insumo: Pick<Insumo, "id" | "nombre" | "unidad" | "stockActual" | "costoUnitario" | "cantidadReferencia" | "precioReferencia">;
  proveedores: Proveedor[];
  onDone: () => void;
}) {
  const [proveedorId, setProveedorId] = React.useState(proveedores[0]?.id ?? "");
  // Se precargan los últimos valores conocidos: casi siempre se compra el mismo
  // bulto al mismo precio, y así el caso común es solo confirmar.
  const [cantidad, setCantidad] = React.useState(insumo.cantidadReferencia || 1);
  const [total, setTotal] = React.useState(insumo.precioReferencia || 0);
  const [fecha, setFecha] = React.useState(new Date().toISOString().slice(0, 10));
  const [metodoPago, setMetodoPago] = React.useState<MetodoPago>("EFECTIVO");
  const [notas, setNotas] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const unidad = UNIDAD_LABEL[insumo.unidad] ?? "unidad";
  const costoNuevo = costoPorUnidad(total, cantidad);

  // Promedio ponderado: el mismo que va a aplicar el servidor. Mostrarlo antes
  // evita la sorpresa de ver el costo del insumo cambiar solo después.
  const stockResultante = insumo.stockActual + cantidad;
  const costoPromedio =
    stockResultante > 0
      ? (insumo.stockActual * insumo.costoUnitario + cantidad * costoNuevo) / stockResultante
      : costoNuevo;
  const sube = costoPromedio > insumo.costoUnitario;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId) return toast.error("Elige un proveedor");
    if (cantidad <= 0) return toast.error("La cantidad debe ser mayor a 0");

    setLoading(true);
    const result = await registrarCompra({
      proveedorId,
      fecha,
      metodoPago,
      notas: notas.trim() || undefined,
      items: [{ insumoId: insumo.id, cantidad, costoUnitario: costoNuevo }],
    });
    setLoading(false);

    if (!result.success) return toast.error(result.error);
    toast.success(`Compra registrada — ${insumo.nombre} en ${redondearCantidad(stockResultante)} ${unidad}`);
    if (result.aviso) toast.warning(result.aviso, { duration: 8000 });
    onDone();
  };

  if (proveedores.length === 0) {
    return (
      <p className="text-sm text-charcoal-400">
        Necesitas al menos un proveedor. Créalo en la pestaña{" "}
        <Link href="/admin/inventario/proveedores" className="underline hover:text-ember-500">
          Proveedores
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-charcoal-400">
        Tienes <strong className="text-charcoal-700 dark:text-cream">{redondearCantidad(insumo.stockActual)} {unidad}</strong>{" "}
        a {formatCosto(insumo.costoUnitario)} por {unidad}.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="proveedorId">¿A quién le compraste?</Label>
          <Select id="proveedorId" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="metodoPagoCompraRapida">¿Con qué pagaste?</Label>
          <Select
            id="metodoPagoCompraRapida"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
          >
            {METODOS_COMPRA.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-charcoal-200 p-3 dark:border-charcoal-600">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[110px] flex-1">
            <span className="mb-1 block text-xs text-charcoal-400">Llegaron ({unidad})</span>
            <Input type="number" step="any" min={0} required value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
          </div>
          <span className="pb-2 text-sm text-charcoal-400">por</span>
          <div className="min-w-[110px] flex-1">
            <span className="mb-1 block text-xs text-charcoal-400">Pagaste (COP)</span>
            <Input type="number" step="any" min={0} required value={total} onChange={(e) => setTotal(Number(e.target.value))} />
          </div>
        </div>
        <p className="mt-2 text-xs text-charcoal-400">
          Sale a <strong className="text-charcoal-700 dark:text-cream">{formatCosto(costoNuevo)}</strong> por {unidad}.{" "}
          {metodoPago === "OTRO"
            ? "Pagada con “Otro” no baja de ningún saldo."
            : `Esos $${Math.round(total).toLocaleString("es-CO")} se descuentan de tu ${metodoPago === "NEQUI" ? "Nequi" : "efectivo"}.`}
        </p>
      </div>

      <div className="rounded-xl bg-charcoal-50 p-3 text-xs dark:bg-charcoal-900/40">
        <p className="text-charcoal-500 dark:text-charcoal-300">
          Vas a quedar con <strong>{redondearCantidad(stockResultante)} {unidad}</strong>, y el costo del insumo pasa a{" "}
          <strong className={sube ? "text-ember-600 dark:text-ember-400" : "text-olive-600 dark:text-olive-400"}>
            {formatCosto(costoPromedio)}
          </strong>{" "}
          por {unidad}.
        </p>
        <p className="mt-1 text-charcoal-400">
          Es el promedio entre lo que ya tenías y lo que acaba de llegar, no el precio de esta compra. Ese promedio es el
          que van a usar tus recetas.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fechaCompra">Fecha</Label>
          <Input id="fechaCompra" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notasCompra">Nota (opcional)</Label>
          <Input id="notasCompra" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: factura #45" />
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Registrando..." : "Registrar compra"}
      </Button>
    </form>
  );
}
