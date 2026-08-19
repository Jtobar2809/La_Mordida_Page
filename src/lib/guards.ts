import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

/**
 * Defensa en profundidad para las páginas del panel.
 *
 * `middleware.ts` ya redirige a quien no sea ADMIN, pero el middleware de
 * Next.js NUNCA debe ser la única capa de autorización: corre antes que el
 * renderizado, en un runtime distinto, y basta un error en su `matcher` (o un
 * fallo del propio framework, como el bypass por cabecera de CVE-2025-29927)
 * para que las páginas queden expuestas. Y estas páginas no muestran cualquier
 * cosa: /admin/clientes lista nombres, correos y teléfonos de toda la base de
 * clientes.
 *
 * Por eso el layout del panel vuelve a comprobar la sesión aquí, ya en el
 * servidor y contra el token real. Si las dos capas están de acuerdo, el coste
 * es una lectura de sesión ya cacheada por request.
 */
export async function requireAdminPage(): Promise<Session> {
  const session = await auth();

  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  return session;
}

/** Equivalente para las páginas de `/cuenta`: exige sesión, sin exigir rol. */
export async function requireUserPage(callbackUrl = "/cuenta"): Promise<Session> {
  const session = await auth();

  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);

  return session;
}
