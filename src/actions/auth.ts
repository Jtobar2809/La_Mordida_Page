"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { consumirIntento, ipDelVisitante, mensajeDeEspera, LIMITES } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(2, "El nombre es muy corto"),
  email: z.string().email("Correo inválido"),
  phone: z.string().min(7, "Teléfono inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

/**
 * Resultado estándar de un server action.
 *
 * `data` es OBLIGATORIO cuando la acción declara un tipo de retorno, y solo
 * opcional en las acciones que no devuelven nada (`ActionResult` a secas).
 * Antes era siempre opcional, así que el compilador obligaba a cada consumidor
 * a tratar `resultado.data` como posiblemente `undefined` incluso después de
 * comprobar `success`, y la salida cómoda era el `!` — que apaga justo la
 * comprobación que uno quiere tener cuando maneja plata.
 */
export type ActionResult<T = undefined> =
  | ([T] extends [undefined]
      ? { success: true; data?: T; aviso?: string }
      : { success: true; data: T; aviso?: string })
  /**
   * Salió bien, pero hay algo que la persona tiene que saber. No es un error
   * —la acción se hizo— y por eso no puede viajar en `error`: un gasto en
   * efectivo sin caja abierta se guarda igual, pero si nadie avisa, el turno
   * cierra con un faltante que nadie sabe explicar.
   */
  | { success: false; error: string };

export async function registerUser(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, email, phone, password } = parsed.data;

  // Por IP: sin esto un script crea cuentas basura sin tope, y cada una dispara
  // un correo de bienvenida que cuesta plata y reputación de dominio.
  const limite = await consumirIntento(`registro:${await ipDelVisitante()}`, LIMITES.registro.limite, LIMITES.registro.ventana);
  if (!limite.permitido) {
    return { success: false, error: `Demasiadas cuentas creadas desde aquí. ${mensajeDeEspera(limite.esperaSegundos)}` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Ya existe una cuenta con este correo." };
  }

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { name, email, phone, password: hashed, role: "CLIENTE" },
  });

  const { sendWelcomeEmail } = await import("@/lib/email");
  await sendWelcomeEmail(email, name);

  return { success: true };
}

const forgotSchema = z.object({ email: z.string().email() });

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Correo inválido" };

  // Dos frenos, porque uno solo no alcanza: por correo para que nadie pueda
  // bombardear el buzón de una persona concreta, y por IP para que rotar
  // direcciones de correo no sirva de nada.
  //
  // El mensaje de bloqueo es el mismo que el de éxito a propósito: decir
  // "espera 30 minutos" solo cuando el correo existe delataría qué correos
  // están registrados, que es justo lo que evita el silencio de más abajo.
  const [porCorreo, porIp] = await Promise.all([
    consumirIntento(`reset:${parsed.data.email}`, LIMITES.resetPorCorreo.limite, LIMITES.resetPorCorreo.ventana),
    consumirIntento(`reset-ip:${await ipDelVisitante()}`, LIMITES.resetPorIp.limite, LIMITES.resetPorIp.ventana),
  ]);
  if (!porCorreo.permitido || !porIp.permitido) return { success: true };

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // No revelamos si el correo existe o no, por seguridad.
  if (user) {
    const token = nanoid(48);
    await prisma.passwordResetToken.create({
      data: {
        email: user.email!,
        token,
        expires: new Date(Date.now() + 1000 * 60 * 30), // 30 minutos
      },
    });

    const { sendPasswordResetEmail } = await import("@/lib/email");
    const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/recuperar-password/${token}`;
    await sendPasswordResetEmail(user.email!, resetUrl);
  }

  return { success: true };
}

const resetSchema = z.object({
  token: z.string(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export async function resetPassword(input: unknown): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { token, password } = parsed.data;
  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return { success: false, error: "El enlace es inválido o expiró. Solicita uno nuevo." };
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { email: record.email }, data: { password: hashed } }),
    prisma.passwordResetToken.delete({ where: { token } }),
  ]);

  return { success: true };
}
