import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Límite de intentos por ventana de tiempo para las acciones públicas.
 *
 * El riesgo concreto que cierra: `requestPasswordReset` mandaba un correo por
 * cada llamada, sin ningún tope. Un script podía disparar miles — eso cuesta
 * plata en Resend y, peor, hace que marquen el dominio como spam. Cuando eso
 * pasa dejas de poder escribirle a tus clientes de verdad, y recuperar la
 * reputación de un dominio toma semanas.
 *
 * El contador vive en Postgres, no en memoria: en Vercel cada petición puede
 * caer en una instancia distinta, así que un `Map` en memoria se reinicia solo
 * y no limita nada.
 */

export type ResultadoLimite = {
  permitido: boolean;
  /** Segundos que faltan para poder reintentar. 0 si está permitido. */
  esperaSegundos: number;
};

/**
 * Suma un intento y dice si se pasó del tope.
 *
 * Cuenta SIEMPRE, incluso el intento que rechaza: si no, alguien podría seguir
 * golpeando indefinidamente una vez alcanzado el límite y la ventana nunca
 * avanzaría hacia el bloqueo.
 */
export async function consumirIntento(
  clave: string,
  limite: number,
  ventanaSegundos: number
): Promise<ResultadoLimite> {
  const ahora = new Date();
  const inicioVentana = new Date(ahora.getTime() - ventanaSegundos * 1000);

  try {
    const actual = await prisma.rateLimit.findUnique({ where: { clave } });

    // Sin registro, o con la ventana ya vencida: arranca una nueva.
    if (!actual || actual.ventanaAt < inicioVentana) {
      await prisma.rateLimit.upsert({
        where: { clave },
        update: { intentos: 1, ventanaAt: ahora },
        create: { clave, intentos: 1, ventanaAt: ahora },
      });
      return { permitido: true, esperaSegundos: 0 };
    }

    const intentos = actual.intentos + 1;
    await prisma.rateLimit.update({ where: { clave }, data: { intentos } });

    if (intentos > limite) {
      const faltan = Math.ceil((actual.ventanaAt.getTime() + ventanaSegundos * 1000 - ahora.getTime()) / 1000);
      return { permitido: false, esperaSegundos: Math.max(faltan, 1) };
    }

    return { permitido: true, esperaSegundos: 0 };
  } catch (error) {
    // Si la base falla, se deja pasar. Un limitador caído no puede convertirse
    // en una caída del registro y del login para todo el mundo: el riesgo que
    // cubre es abuso, no corrupción de datos.
    console.error("[rate-limit] No se pudo consultar el contador:", error);
    return { permitido: true, esperaSegundos: 0 };
  }
}

/**
 * Mira el contador sin sumarle nada.
 *
 * Lo usa el login, donde solo deben contar los intentos FALLIDOS: si contara
 * también los exitosos, alguien que entra y sale del admin diez veces en un
 * rato se bloquearía a sí mismo, y el límite estaría castigando justo a quien sí
 * sabe la contraseña.
 */
export async function revisarLimite(
  clave: string,
  limite: number,
  ventanaSegundos: number
): Promise<ResultadoLimite> {
  try {
    const ahora = new Date();
    const actual = await prisma.rateLimit.findUnique({ where: { clave } });
    if (!actual || actual.ventanaAt < new Date(ahora.getTime() - ventanaSegundos * 1000)) {
      return { permitido: true, esperaSegundos: 0 };
    }
    if (actual.intentos > limite) {
      const faltan = Math.ceil((actual.ventanaAt.getTime() + ventanaSegundos * 1000 - ahora.getTime()) / 1000);
      return { permitido: false, esperaSegundos: Math.max(faltan, 1) };
    }
    return { permitido: true, esperaSegundos: 0 };
  } catch (error) {
    console.error("[rate-limit] No se pudo consultar el contador:", error);
    return { permitido: true, esperaSegundos: 0 };
  }
}

/** Borra el contador. Se llama al acertar la contraseña. */
export async function limpiarIntentos(clave: string) {
  try {
    await prisma.rateLimit.deleteMany({ where: { clave } });
  } catch (error) {
    console.error("[rate-limit] No se pudo limpiar el contador:", error);
  }
}

/**
 * IP del visitante detrás del proxy de Vercel.
 *
 * `x-forwarded-for` trae la cadena de proxies; el primero es el cliente. Se
 * puede falsear, así que la IP nunca es el único freno: las acciones que
 * dependen de un correo se limitan también por correo.
 */
export async function ipDelVisitante(): Promise<string> {
  try {
    const h = await headers();
    const cadena = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "";
    const primera = cadena.split(",")[0]?.trim();
    return primera && primera.length > 0 ? primera : "desconocida";
  } catch {
    return "desconocida";
  }
}

/** Mensaje en español con el tiempo en la unidad que se entiende. */
export function mensajeDeEspera(segundos: number) {
  if (segundos >= 120) return `Intenta de nuevo en ${Math.ceil(segundos / 60)} minutos.`;
  if (segundos >= 60) return "Intenta de nuevo en un minuto.";
  return `Intenta de nuevo en ${segundos} segundos.`;
}

/** Topes por acción, en un solo lugar para poder ajustarlos sin buscarlos. */
export const LIMITES = {
  /** Crear cuenta: generoso para una familia con un solo wifi, letal para un script. */
  registro: { limite: 5, ventana: 60 * 60 },
  /** Recuperar contraseña POR CORREO: es el que evita el bombardeo a un buzón. */
  resetPorCorreo: { limite: 3, ventana: 60 * 60 },
  /** Y por IP, para que no sirva rotar direcciones de correo. */
  resetPorIp: { limite: 10, ventana: 60 * 60 },
  /** Login: 10 fallos seguidos desde la misma IP ya no es alguien distraído. */
  login: { limite: 10, ventana: 15 * 60 },
} as const;
