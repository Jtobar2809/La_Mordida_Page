import * as Sentry from "@sentry/nextjs";

/**
 * Errores del navegador. Igual que en el servidor: sin DSN público no se
 * inicializa nada.
 *
 * Se usa una variable NEXT_PUBLIC_ aparte porque este DSN viaja al navegador y
 * queda a la vista de cualquiera. Es normal y Sentry lo contempla, pero por eso
 * no se reutiliza el del servidor.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    // Ruido que no es tuyo: extensiones del navegador y fallos de red del
    // visitante llenarían el panel sin que haya nada que arreglar.
    ignoreErrors: [
      "ResizeObserver loop",
      "Failed to fetch",
      "NetworkError",
      "Load failed",
      "AbortError",
    ],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
