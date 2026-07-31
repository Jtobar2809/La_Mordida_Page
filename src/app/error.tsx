"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Esto sí aparece en los logs de Vercel (Runtime Logs) aunque el
    // mensaje que ve el cliente sea genérico.
    console.error("Error de renderizado capturado por app/error.tsx:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-display text-3xl text-charcoal-900 dark:text-cream">Algo salió mal</h1>
      <p className="max-w-md text-sm text-charcoal-400">
        Tuvimos un problema al cargar esta página. Tu pedido no se perdió si ya lo confirmaste por WhatsApp.
      </p>
      {error.digest && (
        <p className="text-xs text-charcoal-300">Código de referencia: {error.digest}</p>
      )}
      <div className="mt-2 flex gap-3">
        <Button onClick={() => reset()}>Intentar de nuevo</Button>
        <Link href="/">
          <Button variant="outline">Ir al inicio</Button>
        </Link>
      </div>
    </div>
  );
}
