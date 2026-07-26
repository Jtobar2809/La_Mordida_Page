"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Camera, AlertCircle } from "lucide-react";

interface StampScannerProps {
  open: boolean;
  onClose: () => void;
  onTokenDetected: (token: string) => void;
}

/**
 * Escáner de QR por cámara. Usa el ponyfill `barcode-detector` (WASM/ZXing
 * por debajo), que expone la clase BarcodeDetector como export nombrado
 * sin depender de que el navegador la tenga nativa — necesario porque
 * Safari/iOS no implementa BarcodeDetector de forma nativa todavía.
 *
 * El QR codifica una URL completa (ver StampQRGenerator), así que aquí
 * se extrae el parámetro `token` de esa URL detectada, en vez de asumir
 * que el valor crudo del QR ya es el token.
 */
export function StampScanner({ open, onClose, onTokenDetected }: StampScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafId = React.useRef<number>(0);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setReady(false);

    async function start() {
      try {
        // El ponyfill expone BarcodeDetector como export nombrado — no
        // depende de ni modifica globalThis, se usa directamente.
        const { BarcodeDetector } = await import("barcode-detector/ponyfill");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);

        const detector = new BarcodeDetector({ formats: ["qr_code"] });

        async function tick() {
          if (cancelled || !video) return;
          try {
            const codes = await detector.detect(video);
            const raw = codes[0]?.rawValue;
            if (raw) {
              const token = extractToken(raw);
              if (token) {
                onTokenDetected(token);
                return; // deja de escanear tras un hit
              }
            }
          } catch {
            // frame ilegible o detector aún inicializando — se reintenta en el próximo frame
          }
          rafId.current = requestAnimationFrame(tick);
        }
        rafId.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Necesitamos permiso de cámara para escanear el sello."
            : "No se pudo acceder a la cámara en este dispositivo.";
        setError(message);
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Escanear sello" description="Apunta la cámara al código QR del mostrador">
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-charcoal-900">
        {error ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-cream">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            {!ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-charcoal-900 text-cream">
                <Camera className="h-8 w-8 animate-pulse" />
                <p className="text-sm">Iniciando cámara…</p>
              </div>
            )}
            {ready && (
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-ember-500/80" />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/** El QR codifica una URL como .../cuenta/sellos?token=XYZ — se extrae solo el token */
function extractToken(rawValue: string): string | null {
  try {
    const url = new URL(rawValue);
    return url.searchParams.get("token");
  } catch {
    // No es una URL válida — como fallback, se acepta el valor crudo tal
    // cual por si en algún momento se genera un QR con el token pelado.
    return rawValue.trim() || null;
  }
}
