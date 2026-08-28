"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { obtenerSaldos } from "@/lib/saldos";
import { setSetting } from "@/lib/settings";
import type { ActionResult } from "@/actions/auth";

async function requireAdmin() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("No autorizado");
  return session.user.id;
}

function revalidarSaldos() {
  revalidatePath("/admin/contabilidad");
  revalidatePath("/admin/contabilidad/conciliacion");
  revalidatePath("/admin/caja");
}

const arqueoSchema = z.object({
  saldoReal: z.coerce.number().int().min(0, "El saldo no puede ser negativo"),
  notas: z.string().max(500).optional(),
});

/**
 * Contar el Nequi: se abre la app, se mira el saldo y se escribe aquí.
 *
 * Hace con el celular lo que `cerrarCaja` hace con el cajón, con una diferencia
 * obligada: el cajón se cuenta al cerrar el turno y vuelve a una base, mientras
 * que el saldo de Nequi es acumulado y no se reinicia nunca. Por eso el conteo
 * es un evento con su propia fecha y no una columna del turno.
 *
 * El esperado NO llega del formulario. Se recalcula aquí, en el servidor, en el
 * mismo instante en que se guarda: si viniera del cliente, una pestaña abierta
 * desde la mañana congelaría un esperado viejo y la diferencia que queda
 * firmada sería contra un número que ya no existía.
 */
export async function registrarArqueoNequi(
  input: unknown
): Promise<ActionResult<{ esperado: number; diferencia: number }>> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = arqueoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { saldoReal, notas } = parsed.data;

  const { nequi } = await obtenerSaldos();
  const esperado = nequi.saldo;
  const diferencia = saldoReal - esperado;

  await prisma.arqueoNequi.create({
    data: {
      fecha: new Date(),
      saldoEsperado: esperado,
      saldoReal,
      diferencia,
      notas: notas?.trim() || null,
      createdById: userId,
    },
  });

  revalidarSaldos();
  return { success: true, data: { esperado, diferencia } };
}

const saldoInicialSchema = z.object({
  monto: z.coerce.number().int().min(0, "El saldo no puede ser negativo"),
});

/**
 * El punto de partida del saldo de Nequi: cuánto había en el celular el día que
 * se empezó a llevar la cuenta.
 *
 * Solo sirve mientras no exista ningún arqueo. En cuanto se cuenta una vez, el
 * arqueo manda y este número deja de leerse — por eso se rechaza el cambio en
 * vez de guardarlo en silencio: editarlo después no movería nada y el dueño se
 * quedaría esperando un efecto que nunca llega.
 */
export async function guardarSaldoInicialNequi(input: unknown): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, error: "No autorizado" };
  }

  const parsed = saldoInicialSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const yaArqueado = await prisma.arqueoNequi.findFirst({ select: { id: true } });
  if (yaArqueado) {
    return {
      success: false,
      error: "Ya hiciste al menos un arqueo, así que el saldo se cuenta desde ahí. Para corregirlo, haz un arqueo nuevo con el saldo real.",
    };
  }

  await setSetting("nequiSaldoInicial", String(parsed.data.monto));

  revalidarSaldos();
  return { success: true };
}
