import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Primera capa de autorización: redirige antes de renderizar.
 *
 * Dos cosas cambiaron respecto a la versión anterior:
 *
 *  1. Ya no importa `@/auth` sino `@/auth.config`. El middleware solo necesita
 *     decodificar el JWT, no consultar la base de datos, así que no tiene por
 *     qué arrastrar PrismaAdapter/@prisma/client/bcrypt a su bundle (eran
 *     239 kB cargándose en cada petición a /admin y /cuenta).
 *
 *  2. Ya no aplica las cabeceras de seguridad a mano. Al vivir aquí, solo
 *     protegían las dos rutas del `matcher` — la home, el menú, /login y
 *     /registro se servían sin CSP ni X-Frame-Options. Ahora se declaran en
 *     `next.config.mjs` y cubren todas las respuestas del sitio.
 *
 * Esta sigue siendo la PRIMERA capa, no la única: los layouts de /admin y
 * /cuenta vuelven a comprobar la sesión en el servidor (src/lib/guards.ts).
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isAccountRoute = nextUrl.pathname.startsWith("/cuenta");

  if (isAdminRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl)
      );
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  if (isAccountRoute && !isLoggedIn) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(nextUrl.pathname)}`, nextUrl)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/cuenta/:path*"],
};
