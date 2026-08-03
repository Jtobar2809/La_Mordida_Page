import Link from "next/link";
import { MessageCircle, Cake } from "lucide-react";
import { Prisma, PrismaClient, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate, formatCOP } from "@/lib/utils";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { ESTADOS_VENTA_CONFIRMADA } from "@/lib/inventario";
import { Badge } from "@/components/ui/badge";
import { CopyPhonesButton } from "@/components/admin/copy-phones-button";

export const dynamic = "force-dynamic";

// Umbrales de segmentación — ajústalos aquí si no calzan con tu ticket promedio real.
const DIAS_EN_RIESGO = 15;
const DIAS_INACTIVO = 30;
const PEDIDOS_VIP = 5;
const GASTO_VIP = 200_000; // COP

type Segmento = "vip" | "activo" | "riesgo" | "inactivo" | "nuevo";

const SEGMENTOS: {
key: Segmento | "todos";
label: string;
variant: "mustard" | "olive" | "ember" | "charcoal" | "outline";
}[] = [
{ key: "todos", label: "Todos", variant: "outline" },
{ key: "vip", label: "VIP", variant: "mustard" },
{ key: "activo", label: "Activos", variant: "olive" },
{ key: "riesgo", label: "En riesgo", variant: "ember" },
{ key: "inactivo", label: "Inactivos", variant: "charcoal" },
{ key: "nuevo", label: "Nuevos / sin compras", variant: "outline" },
];

function calcularSegmento(
numPedidos: number,
diasDesdeUltimo: number | null,
totalGastado: number
): Segmento {
if (numPedidos === 0) return "nuevo";
if (diasDesdeUltimo !== null && diasDesdeUltimo > DIAS_INACTIVO) {
return "inactivo";
}
if (diasDesdeUltimo !== null && diasDesdeUltimo > DIAS_EN_RIESGO) {
return "riesgo";
}
if (numPedidos >= PEDIDOS_VIP || totalGastado >= GASTO_VIP) {
return "vip";
}
return "activo";
}

function diasHastaProximoCumple(birthDate: Date): number {
const hoy = new Date();

const hoyUTC = Date.UTC(
hoy.getFullYear(),
hoy.getMonth(),
hoy.getDate()
);

let proximo = Date.UTC(
hoy.getFullYear(),
birthDate.getUTCMonth(),
birthDate.getUTCDate()
);

if (proximo < hoyUTC) {
proximo = Date.UTC(
hoy.getFullYear() + 1,
birthDate.getUTCMonth(),
birthDate.getUTCDate()
);
}

return Math.round((proximo - hoyUTC) / 86400000);
}

/**

* Tipo exacto que esperamos recibir desde Prisma.
*
* Se declara explícitamente para evitar que TypeScript pierda
* las relaciones `orders` y `stampCard` al construir las métricas.
  */
  type CustomerWithRelations = Prisma.UserGetPayload<{
  include: {
  stampCard: true;
  orders: {
  where: {
  status: {
  in: OrderStatus[];
  };
  };
  select: {
  total: true;
  createdAt: true;
  };
  orderBy: {
  createdAt: "desc";
  };
  };
  };
  }>;

export default async function AdminCustomersPage({
searchParams,
}: {
searchParams: Promise<{ segmento?: string }>;
}) {
const { segmento: filtroParam } = await searchParams;

const filtro = (filtroParam ?? "todos") as Segmento | "todos";

/**

* Prisma exige OrderStatus[] y no string[].
*
* ESTADOS_VENTA_CONFIRMADA contiene los valores válidos de OrderStatus,
* por eso se tipa explícitamente antes de pasarlo a Prisma.
  */
  const estadosVentaConfirmada =
  ESTADOS_VENTA_CONFIRMADA as OrderStatus[];

const customers: CustomerWithRelations[] =
await prisma.user.findMany({
where: {
role: "CLIENTE",
},
orderBy: {
createdAt: "desc",
},
take: 300,
include: {
stampCard: true,
orders: {
where: {
status: {
in: estadosVentaConfirmada,
},
},
select: {
total: true,
createdAt: true,
},
orderBy: {
createdAt: "desc",
},
},
},
});

const conMetricas = customers.map((c) => {
const numPedidos = c.orders.length;
const totalGastado = c.orders.reduce(
  (suma, pedido) => suma + pedido.total,
  0
);

const ultimoPedido = c.orders[0]?.createdAt ?? null;

const diasDesdeUltimo = ultimoPedido
  ? Math.floor(
      (Date.now() - new Date(ultimoPedido).getTime()) / 86400000
    )
  : null;

const segmento = calcularSegmento(
  numPedidos,
  diasDesdeUltimo,
  totalGastado
);

const diasCumple = c.birthDate
  ? diasHastaProximoCumple(new Date(c.birthDate))
  : null;

return {
  ...c,
  numPedidos,
  totalGastado,
  ultimoPedido,
  diasDesdeUltimo,
  segmento,
  diasCumple,
};

});

const filtrados =
filtro === "todos"
? conMetricas
: conMetricas.filter((c) => c.segmento === filtro);

const cumpleanosProximos = conMetricas
.filter(
(c) =>
c.diasCumple !== null &&
c.diasCumple <= 14
)
.sort(
(a, b) =>
(a.diasCumple ?? 0) - (b.diasCumple ?? 0)
);

const contadores = SEGMENTOS.reduce<Record<string, number>>(
(acc, s) => {
acc[s.key] =
s.key === "todos"
? conMetricas.length
: conMetricas.filter(
(c) => c.segmento === s.key
).length;

  return acc;
},
{}


);

const telefonosFiltrados = filtrados
.map((c) => c.phone)
.filter((p): p is string => Boolean(p));

return ( <div> <div className="mb-1 flex flex-wrap items-center justify-between gap-4"> <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">
CLIENTES </h1>

    <CopyPhonesButton phones={telefonosFiltrados} />
  </div>

  <p className="mb-6 text-sm text-charcoal-400">
    {customers.length} cliente(s) registrados
  </p>

  {cumpleanosProximos.length > 0 && (
    <div className="mb-6 rounded-2xl border border-mustard-200 bg-mustard-50 p-4 dark:border-mustard-800 dark:bg-mustard-900/20">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-mustard-800 dark:text-mustard-200">
        <Cake className="h-4 w-4" />
        Cumpleaños en los próximos 14 días
      </p>

      <div className="flex flex-wrap gap-2">
        {cumpleanosProximos.map((c) => (
          <a
            key={c.id}
            href={
              c.phone
                ? buildWhatsappLink(
                    c.phone,
                    `¡Hola ${c.name}! 🎉 Todo el equipo de La Mordida te desea un feliz cumpleaños. Tenemos algo especial para ti, ¡pásate por la tienda!`
                  )
                : "#"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-mustard-800 shadow-sm hover:bg-mustard-100 dark:bg-charcoal-800 dark:text-mustard-200 dark:hover:bg-charcoal-700"
          >
            {c.name} ·{" "}
            {c.diasCumple === 0
              ? "hoy"
              : `en ${c.diasCumple}d`}
          </a>
        ))}
      </div>
    </div>
  )}

  <div className="mb-4 flex flex-wrap gap-2 text-sm">
    {SEGMENTOS.map((s) => (
      <Link
        key={s.key}
        href={`/admin/clientes?segmento=${s.key}`}
        className={
          filtro === s.key
            ? "rounded-full bg-charcoal-800 px-3 py-1.5 font-medium text-white dark:bg-cream dark:text-charcoal-900"
            : "rounded-full px-3 py-1.5 font-medium text-charcoal-500 hover:bg-charcoal-100 dark:text-charcoal-300 dark:hover:bg-charcoal-700/50"
        }
      >
        {s.label} ({contadores[s.key] ?? 0})
      </Link>
    ))}
  </div>

  <div className="overflow-hidden rounded-2xl border border-charcoal-100 bg-white dark:border-charcoal-700 dark:bg-charcoal-800">
    <table className="w-full text-sm">
      <thead className="border-b border-charcoal-100 bg-charcoal-50 text-left text-xs uppercase tracking-wide text-charcoal-400 dark:border-charcoal-700 dark:bg-charcoal-900/40">
        <tr>
          <th className="px-4 py-3">Cliente</th>
          <th className="px-4 py-3">Segmento</th>
          <th className="px-4 py-3">Pedidos</th>
          <th className="px-4 py-3">Gastado</th>
          <th className="px-4 py-3">Última compra</th>
          <th className="px-4 py-3">Sellos</th>
          <th className="px-4 py-3 text-right">
            Contacto
          </th>
        </tr>
      </thead>

      <tbody className="divide-y divide-charcoal-100 dark:divide-charcoal-700">
        {filtrados.map((c) => {
          const seg =
            SEGMENTOS.find(
              (s) => s.key === c.segmento
            )!;

          return (
            <tr key={c.id}>
              <td className="px-4 py-3">
                <p className="font-semibold text-charcoal-900 dark:text-cream">
                  {c.name}
                </p>

                <p className="text-xs text-charcoal-400">
                  {c.email}
                </p>
              </td>

              <td className="px-4 py-3">
                <Badge variant={seg.variant}>
                  {seg.label}
                </Badge>
              </td>

              <td className="px-4 py-3">
                {c.numPedidos}
              </td>

              <td className="px-4 py-3 font-mono">
                {formatCOP(c.totalGastado)}
              </td>

              <td className="px-4 py-3 text-charcoal-400">
                {c.ultimoPedido
                  ? `${formatDate(c.ultimoPedido)} (hace ${c.diasDesdeUltimo}d)`
                  : "—"}
              </td>

              <td className="px-4 py-3 font-mono font-bold text-ember-600">
                {c.stampCard
                  ? `${c.stampCard.currentStamps}/7`
                  : "0/7"}
              </td>

              <td className="px-4 py-3 text-right">
                {c.phone ? (
                  <a
                    href={buildWhatsappLink(
                      c.phone,
                      `¡Hola ${c.name}! Te escribimos desde La Mordida 🍔`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-olive-600 hover:underline dark:text-olive-400"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                ) : (
                  <span className="text-charcoal-300">
                    —
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>

    {filtrados.length === 0 && (
      <p className="p-8 text-center text-sm text-charcoal-400">
        Sin clientes en este segmento.
      </p>
    )}
  </div>

  <p className="mt-4 text-xs text-charcoal-400">
    VIP: 5+ pedidos o {formatCOP(GASTO_VIP)}+ gastados · En
    riesgo: sin comprar hace más de {DIAS_EN_RIESGO} días ·
    Inactivo: más de {DIAS_INACTIVO} días. Para lanzar una
    promoción dirigida, copia los teléfonos del segmento
    arriba y crea un cupón en{" "}
    <Link
      href="/admin/cupones"
      className="underline"
    >
      /admin/cupones
    </Link>
    .
  </p>
</div>

);
}
