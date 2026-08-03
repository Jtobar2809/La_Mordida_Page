"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Stamp, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateStampQRAction } from "@/actions/stamps";

/**
 * Panel del admin para generar el QR de sello tras una compra en
 * mostrador. El QR codifica una URL completa (no solo el token) para
 * que funcione como deep-link incluso si el cliente lo escanea con la
 * cámara nativa del celular sin tener la página de la tienda abierta.
 * La URL viene ya armada desde el servidor (con el dominio público fijo,
 * no con window.location.origin de este dispositivo) para que el QR
 * funcione sin importar desde qué red o URL esté el mostrador viendo
 * el panel. Muestra una cuenta regresiva en vivo hasta la expiración
 * (10 min) y se refresca solo cuando expira, para que el mostrador no
 * quede con un QR muerto en pantalla sin darse cuenta.
 */
export function StampQRGenerator() {
  const [claimUrl, setClaimUrl] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  async function generate() {
    setLoading(true);
    const result = await generateStampQRAction();
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (!result.data) {
      toast.error("No se pudo generar el código.");
      return;
    }

    setClaimUrl(result.data.claimUrl);
    setExpiresAt(new Date(result.data.expiresAt));
  }

  React.useEffect(() => {
    if (!expiresAt) return;
    const target = expiresAt; // referencia con tipo estrecho, capturada por el closure de abajo

    function tick() {
      const remaining = Math.max(0, Math.round((target.getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const expired = expiresAt !== null && secondsLeft <= 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <Card className="flex flex-col items-center gap-4 p-8 text-center">
      {!claimUrl && (
        <>
          <Stamp className="h-10 w-10 text-ember-500" />
          <p className="max-w-sm text-sm text-charcoal-500 dark:text-charcoal-300">
            Genera un código después de confirmar una compra en mostrador. El cliente lo escanea desde su cuenta
            para recibir el sello.
          </p>
          <Button onClick={generate} disabled={loading} size="lg">
            {loading ? "Generando..." : "Generar código de sello"}
          </Button>
        </>
      )}

      {claimUrl && (
        <>
          <div
            className={`rounded-2xl border-4 p-4 transition-colors ${
              expired ? "border-charcoal-200 opacity-40 dark:border-charcoal-700" : "border-ember-500"
            }`}
          >
            <QRCodeSVG value={claimUrl} size={220} level="M" />
          </div>

          {!expired ? (
            <p className="font-mono text-lg font-bold text-charcoal-700 dark:text-charcoal-100">
              Expira en {minutes}:{seconds.toString().padStart(2, "0")}
            </p>
          ) : (
            <p className="font-semibold text-red-500">Este código expiró</p>
          )}

          <Button onClick={generate} disabled={loading} variant={expired ? "primary" : "secondary"} size="lg">
            <RefreshCw className="h-4 w-4" />
            {loading ? "Generando..." : "Generar nuevo código"}
          </Button>
        </>
      )}
    </Card>
  );
}
