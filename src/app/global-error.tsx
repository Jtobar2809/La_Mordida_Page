"use client";

import * as React from "react";

// Se activa solo si el propio RootLayout (src/app/layout.tsx) falla al
// renderizar. Por eso necesita sus propias etiquetas <html>/<body>: en ese
// caso el layout normal ni siquiera llegó a montarse.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Error global capturado por app/global-error.tsx:", error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 28 }}>Algo salió mal</h1>
          <p style={{ maxWidth: 420, color: "#666" }}>
            Tuvimos un problema al cargar La Mordida. Si ya confirmaste tu pedido por WhatsApp, no se perdió.
          </p>
          {error.digest && <p style={{ fontSize: 12, color: "#999" }}>Código de referencia: {error.digest}</p>}
          <button
            onClick={() => reset()}
            style={{ padding: "10px 24px", borderRadius: 999, background: "#E85C2B", color: "white", border: "none", cursor: "pointer" }}
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
