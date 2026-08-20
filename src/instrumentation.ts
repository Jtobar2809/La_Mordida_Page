import * as Sentry from "@sentry/nextjs";

/**
 * Reporte de errores del servidor.
 *
 * Antes de esto, un fallo en producción terminaba en un `console.error` dentro
 * de los logs de Vercel que nadie mira. Si el checkout se rompía para un
 * cliente, te enterabas porque el cliente se quejaba — o no te enterabas.
 *
 * Sin `SENTRY_DSN` esto no hace absolutamente nada: ni se inicializa, ni manda
 * peticiones, ni falla. Eso es a propósito, para que el código pueda estar en
 * producción antes de que exista la cuenta, y para que en local no se llene el
 * panel de ruido mientras se desarrolla.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      // Solo errores, sin trazas de rendimiento: para un negocio de este tamaño
      // el muestreo de transacciones gasta la cuota gratis sin decir nada útil.
      tracesSampleRate: 0,
      environment: process.env.VERCEL_ENV ?? "development",
      // Un error que se repite en cada carga no debe consumir la cuota del mes.
      maxBreadcrumbs: 20,
    });
  }
}

/** Next lo llama cuando revienta algo dentro de un Server Component o acción. */
export const onRequestError = Sentry.captureRequestError;
