"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

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
  | ([T] extends [undefined] ? { success: true; data?: T } : { success: true; data: T })
  | { success: false; error: string };

export async function registerUser(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, email, phone, password } = parsed.data;

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
