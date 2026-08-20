import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { consumirIntento, revisarLimite, limpiarIntentos, ipDelVisitante, LIMITES } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // La base compartida con el middleware (sesión, páginas, callback de
  // sesión). Ver el comentario de src/auth.config.ts.
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Freno al probador de contraseñas. Solo cuentan los intentos FALLIDOS:
        // sumar también los exitosos bloquearía a quien entra y sale del admin
        // varias veces en un rato, o sea justo a quien sí sabe la contraseña.
        //
        // Se cuenta por correo Y por IP: solo por correo, alguien que ataca
        // muchas cuentas a la vez nunca toca el tope de ninguna; solo por IP,
        // una oficina entera compartiría el castigo de un despistado.
        const claveCorreo = `login:${email}`;
        const claveIp = `login-ip:${await ipDelVisitante()}`;
        const [porCorreo, porIp] = await Promise.all([
          revisarLimite(claveCorreo, LIMITES.login.limite, LIMITES.login.ventana),
          revisarLimite(claveIp, LIMITES.login.limite * 3, LIMITES.login.ventana),
        ]);
        // NextAuth solo entiende `null` aquí, así que un bloqueo se ve igual que
        // una contraseña mala. Es aceptable: quien está bloqueado ya falló diez
        // veces, y distinguir los dos casos le diría al atacante que el correo
        // existe.
        if (!porCorreo.permitido || !porIp.permitido) return null;

        const fallo = async () => {
          await Promise.all([
            consumirIntento(claveCorreo, LIMITES.login.limite, LIMITES.login.ventana),
            consumirIntento(claveIp, LIMITES.login.limite * 3, LIMITES.login.ventana),
          ]);
          return null;
        };

        const user = await prisma.user.findUnique({ where: { email } });
        // Un correo que no existe también cuenta: si no, probar usuarios sería
        // gratis y bastaría para saber cuáles están registrados.
        if (!user || !user.password) return fallo();

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return fallo();

        // Contraseña correcta: el contador vuelve a cero para que los tropiezos
        // de hoy no se acumulen contra el login de mañana.
        await Promise.all([limpiarIntentos(claveCorreo), limpiarIntentos(claveIp)]);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const { sendWelcomeEmail } = await import("@/lib/email");
      await sendWelcomeEmail(user.email, user.name ?? "cliente");
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "CLIENTE";
      }
      // Refresca el rol si cambia en la base de datos durante la sesión
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.id as string } });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "CLIENTE" | "ADMIN") ?? "CLIENTE";
      }
      return session;
    },
  },
});
