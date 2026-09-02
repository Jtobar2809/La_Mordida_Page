import { prisma } from "@/lib/prisma";
import { obtenerCajaAbierta } from "@/lib/caja";
import { obtenerCupoDelMesActual } from "@/lib/retiros";
import { CajaWorkspace } from "@/components/admin/caja/caja-workspace";
import { EMAIL_CLIENTE_MOSTRADOR } from "@/lib/caja";
import type { CategoriaPOS } from "@/types/caja";

export const dynamic = "force-dynamic";

export default async function AdminCajaPage() {
  const [sesion, cupo, categorias, clientes] = await Promise.all([
    obtenerCajaAbierta(),
    // El cupo de retiros es del MES, no del turno: por eso se consulta aquí y
    // no sale del arqueo, que solo sabe de las últimas horas.
    obtenerCupoDelMesActual(),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        products: {
          // A propósito NO se filtra por `available`: en el mostrador se vende
          // lo que hay en la parrilla, aunque en la web esté marcado agotado.
          // La grilla lo muestra atenuado para que el cajero lo note.
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            price: true,
            image: true,
            available: true,
            categoryId: true,
            extras: { where: { active: true }, select: { id: true, name: true, price: true }, orderBy: { price: "asc" } },
          },
        },
      },
    }),

    // Los clientes registrados, para poder ponerle nombre a una venta de
    // mostrador. Se excluye el cliente genérico: elegirlo a mano no significa
    // nada, es exactamente lo que pasa cuando no se elige a nadie.
    prisma.user.findMany({
      where: { role: "CLIENTE", email: { not: EMAIL_CLIENTE_MOSTRADOR } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
  ]);

  const catalogo: CategoriaPOS[] = categorias
    .filter((c) => c.products.length > 0)
    .map((c) => ({ id: c.id, name: c.name, productos: c.products }));

  // Las ventas del turno, para poder anular la que se acaba de cobrar mal.
  const ventas = sesion
    ? await prisma.order.findMany({
        where: { cajaSesionId: sesion.id, canal: "CAJA" },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          total: true,
          status: true,
          metodoPago: true,
          createdAt: true,
          items: { select: { quantity: true, product: { select: { name: true } } } },
        },
      })
    : [];

  return <CajaWorkspace sesion={sesion} catalogo={catalogo} ventas={ventas} cupo={cupo} clientes={clientes} />;
}
