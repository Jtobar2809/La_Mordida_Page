import { CheckCircle2, TriangleAlert, Wallet, Receipt, Package } from "lucide-react";
import { formatCosto, redondearCantidad, UNIDAD_LABEL } from "@/lib/costos";
import { formatDateTime } from "@/lib/utils";
import type { Conciliacion } from "@/lib/conciliacion";

export function ConciliacionView({ datos }: { datos: Conciliacion }) {
  const {
    turnos,
    turnosDescuadrados,
    totalSobrante,
    totalFaltante,
    hayTurnoAbierto,
    ventasMostrador,
    ventasMostradorCantidad,
    cobradoEnCaja,
    diferenciaVentas,
    ventasSinRastro,
    ventasWeb,
    insumos,
    totalComprado,
    totalConsumido,
  } = datos;

  return (
    <div className="space-y-6">
      {/* ── 1. Arqueo de caja ───────────────────────────────────────────── */}
      <Bloque
        icono={<Wallet className="h-4 w-4 text-ember-500" />}
        titulo="LA CAJA CUADRÓ"
        subtitulo="Lo que se contó al cerrar cada turno contra lo que el sistema esperaba."
      >
        {turnos.length === 0 ? (
          <Vacio>
            No hay turnos cerrados en este mes.
            {hayTurnoAbierto ? " Tienes uno abierto: aparecerá aquí cuando lo cierres." : ""}
          </Vacio>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Cifra label="Turnos cerrados" valor={String(turnos.length)} />
              <Cifra label="Faltó" valor={formatCosto(totalFaltante)} tono={totalFaltante > 0 ? "malo" : "bueno"} />
              <Cifra label="Sobró" valor={formatCosto(totalSobrante)} />
            </div>

            {turnosDescuadrados.length === 0 ? (
              <Cuadro tono="bueno">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Los {turnos.length} turnos cerraron exactos. La plata contada coincidió con la esperada en todos.</p>
              </Cuadro>
            ) : (
              <>
                <Cuadro tono={totalFaltante > 0 ? "malo" : "neutro"}>
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    {turnosDescuadrados.length} de {turnos.length} turnos no cuadraron. Un faltante suelto es error de
                    vueltas; el mismo faltante repitiéndose turno tras turno es otra cosa.
                  </p>
                </Cuadro>

                <Tabla cabeceras={["Turno", "Cerrado", "Esperado", "Contado", "Diferencia"]}>
                  {turnosDescuadrados.map((t) => (
                    <tr key={t.id} className="bg-white dark:bg-charcoal-800">
                      <td className="px-4 py-2.5 font-mono font-medium text-charcoal-900 dark:text-cream">{t.codigo}</td>
                      <td className="px-4 py-2.5 text-charcoal-400">{t.cerradaAt ? formatDateTime(t.cerradaAt) : "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-charcoal-400">{formatCosto(t.esperadoEfectivo)}</td>
                      <td className="px-4 py-2.5 font-mono">{formatCosto(t.efectivoContado)}</td>
                      <td
                        className={`px-4 py-2.5 font-mono font-semibold ${
                          t.diferencia < 0 ? "text-red-600 dark:text-red-400" : "text-olive-600 dark:text-olive-400"
                        }`}
                      >
                        {t.diferencia > 0 ? "+" : "−"}
                        {formatCosto(Math.abs(t.diferencia))}
                      </td>
                    </tr>
                  ))}
                </Tabla>
              </>
            )}
          </>
        )}
      </Bloque>

      {/* ── 2. Ventas vs plata cobrada ──────────────────────────────────── */}
      <Bloque
        icono={<Receipt className="h-4 w-4 text-ember-500" />}
        titulo="TODA VENTA DEJÓ SU RASTRO"
        subtitulo="Cada pedido de mostrador debería tener su cobro registrado en la caja."
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cifra label={`Vendido en mostrador (${ventasMostradorCantidad})`} valor={formatCosto(ventasMostrador)} />
          <Cifra label="Cobrado por caja" valor={formatCosto(cobradoEnCaja)} />
          <Cifra
            label="Diferencia"
            valor={formatCosto(Math.abs(diferenciaVentas))}
            tono={diferenciaVentas === 0 ? "bueno" : "malo"}
          />
        </div>

        {ventasSinRastro.length === 0 ? (
          <Cuadro tono="bueno">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Todos los pedidos de mostrador tienen su cobro registrado.
              {ventasWeb > 0 && (
                <>
                  {" "}
                  Los {formatCosto(ventasWeb)} de pedidos web quedan fuera de esta comparación a propósito: un domicilio
                  se paga en la puerta y nunca pasa por el cajón.
                </>
              )}
            </p>
          </Cuadro>
        ) : (
          <>
            <Cuadro tono="malo">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {ventasSinRastro.length} pedido(s) de mostrador sin cobro registrado en caja. O se cobró por fuera del
                sistema, o se entregó sin cobrar.
              </p>
            </Cuadro>
            <Tabla cabeceras={["Pedido", "Fecha", "Método", "Total"]}>
              {ventasSinRastro.map((v) => (
                <tr key={v.id} className="bg-white dark:bg-charcoal-800">
                  <td className="px-4 py-2.5 font-mono text-xs text-charcoal-400">{v.id.slice(-8)}</td>
                  <td className="px-4 py-2.5 text-charcoal-400">{formatDateTime(v.createdAt)}</td>
                  <td className="px-4 py-2.5 text-charcoal-400">{v.metodoPago?.toLowerCase() ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono">{formatCosto(v.total)}</td>
                </tr>
              ))}
            </Tabla>
          </>
        )}
      </Bloque>

      {/* ── 3. Comprado vs consumido ────────────────────────────────────── */}
      <Bloque
        icono={<Package className="h-4 w-4 text-ember-500" />}
        titulo="COMPRADO CONTRA CONSUMIDO"
        subtitulo="No tienen por qué ser iguales: la diferencia es despensa. Lo que importa es que tenga sentido."
      >
        {insumos.length === 0 ? (
          <Vacio>
            No hay compras ni consumo registrados en este mes. Registra tus compras en Inventario › Compras para que esta
            comparación empiece a servir.
          </Vacio>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Cifra label="Comprado" valor={formatCosto(totalComprado)} />
              <Cifra label="Consumido" valor={formatCosto(totalConsumido)} />
              <Cifra label="Quedó en despensa" valor={formatCosto(totalComprado - totalConsumido)} />
            </div>

            <Tabla cabeceras={["Insumo", "Comprado", "Preparado", "Consumido", "Diferencia", "En plata"]}>
              {insumos.slice(0, 15).map((i) => {
                const u = UNIDAD_LABEL[i.unidad] ?? i.unidad;
                return (
                  <tr key={i.nombre} className="bg-white dark:bg-charcoal-800">
                    <td className="px-4 py-2.5 font-medium text-charcoal-900 dark:text-cream">{i.nombre}</td>
                    <td className="px-4 py-2.5 font-mono text-charcoal-400">
                      {redondearCantidad(i.comprado)} {u}
                    </td>
                    {/* Un elaborado no se compra: sale de una tanda de cocina.
                        Sin esta columna aparecía consumiéndose de la nada. */}
                    <td className="px-4 py-2.5 font-mono text-charcoal-400">
                      {i.producido > 0 ? `${redondearCantidad(i.producido)} ${u}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-charcoal-400">
                      {redondearCantidad(i.consumido)} {u}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {i.diferencia > 0 ? "+" : ""}
                      {redondearCantidad(i.diferencia)} {u}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-charcoal-500 dark:text-charcoal-300">
                      {formatCosto(i.valorDiferencia)}
                    </td>
                  </tr>
                );
              })}
            </Tabla>
            <p className="mt-2 text-xs text-charcoal-400">
              Consumido es todo lo que salió del estante: ventas, desechables, tandas de cocina y mermas. Un insumo que
              consumes mucho más de lo que compras está saliendo de la despensa y en algún momento se acaba. Uno que
              compras y no consumes está durmiendo plata en la nevera. Para saber si además se está perdiendo, la
              respuesta está en el conteo físico.
            </p>
          </>
        )}
      </Bloque>
    </div>
  );
}

function Bloque({
  icono,
  titulo,
  subtitulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-charcoal-100 bg-white p-5 dark:border-charcoal-700 dark:bg-charcoal-800">
      <h2 className="flex items-center gap-2 font-display text-lg tracking-wide text-charcoal-900 dark:text-cream">
        {icono}
        {titulo}
      </h2>
      <p className="mb-4 text-xs text-charcoal-400">{subtitulo}</p>
      {children}
    </section>
  );
}

function Cifra({ label, valor, tono }: { label: string; valor: string; tono?: "bueno" | "malo" }) {
  return (
    <div className="rounded-xl bg-charcoal-50 p-3 dark:bg-charcoal-900/40">
      <p className="text-xs uppercase tracking-wide text-charcoal-400">{label}</p>
      <p
        className={`mt-1 font-display text-xl ${
          tono === "malo"
            ? "text-red-600 dark:text-red-400"
            : tono === "bueno"
              ? "text-olive-600 dark:text-olive-400"
              : "text-charcoal-900 dark:text-cream"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

function Cuadro({ tono, children }: { tono: "bueno" | "malo" | "neutro"; children: React.ReactNode }) {
  const clases =
    tono === "bueno"
      ? "border-olive-300 bg-olive-50 text-olive-900 dark:border-olive-700 dark:bg-olive-900/20 dark:text-olive-200"
      : tono === "malo"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
        : "border-charcoal-200 bg-charcoal-50 text-charcoal-600 dark:border-charcoal-600 dark:bg-charcoal-900/40 dark:text-charcoal-300";
  return <div className={`mb-3 flex items-start gap-2 rounded-xl border p-3 text-sm ${clases}`}>{children}</div>;
}

function Tabla({ cabeceras, children }: { cabeceras: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-charcoal-100 dark:border-charcoal-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-charcoal-50 text-xs uppercase tracking-wide text-charcoal-400 dark:bg-charcoal-900/40">
          <tr>
            {cabeceras.map((c) => (
              <th key={c} className="px-4 py-2.5">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">{children}</tbody>
      </table>
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-charcoal-200 py-8 text-center text-sm text-charcoal-400 dark:border-charcoal-600">
      {children}
    </p>
  );
}
