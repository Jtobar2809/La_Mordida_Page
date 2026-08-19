import type { NextAuthConfig } from "next-auth";

/**
 * Configuración de Auth.js compartida entre el servidor y el middleware.
 *
 * A propósito NO contiene el adaptador de Prisma, ni los providers, ni bcrypt:
 * el middleware solo necesita *leer* y decodificar el JWT de la cookie para
 * saber si hay sesión y qué rol tiene, nunca consultar la base de datos.
 *
 * Importar `@/auth` completo en el middleware arrastraba PrismaAdapter,
 * @prisma/client, bcryptjs y Zod al bundle del middleware: 239 kB que se
 * cargan en cada petición a /admin y /cuenta, con el coste de arranque en frío
 * correspondiente. Este archivo es la mitad "ligera" de esa separación (el
 * patrón recomendado por NextAuth v5), y `src/auth.ts` es la mitad "completa"
 * que sí habla con la base de datos.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "CLIENTE" | "ADMIN") ?? "CLIENTE";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
