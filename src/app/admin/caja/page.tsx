import { prisma } from "@/lib/prisma";
import { obtenerCajaAbierta } from "@/lib/caja";
import { CajaWorkspace } from "@/components/admin/caja/caja-workspace";
import type { CategoriaPOS } from "@/types/caja";

export const dynamic = "force-dynamic";

export default async function AdminCajaPage() {
  const [sesion, categorias] = await Promise.all([
    obtenerCajaAbierta(),
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

  return <CajaWorkspace sesion={sesion} catalogo={catalogo} ventas={ventas} />;
}
