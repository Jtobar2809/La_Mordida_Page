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
 * IMPORTANTE: getUserMedia (acceso a cámara) requiere un contexto
 * seguro — HTTPS o localhost. En http:// sobre un dominio o IP normal,
 * el navegador bloquea el acceso a la cámara directamente y esto
 * fallará con "No se pudo acceder a la cámara", sin relación alguna
 * con el QR en sí.
 *
 * La detección se hace sobre un snapshot en <canvas> del frame actual
 * del video (no pasando el <video> en vivo directo al detector), que
 * es el método con compatibilidad más amplia entre navegadores para
 * este ponyfill.
 *
 * El QR codifica una URL completa (ver StampQRGenerator), así que aquí
 * se extrae el parámetro `token` de esa URL detectada, en vez de asumir
 * que el valor crudo del QR ya es el token.
 */
export function StampScanner({ open, onClose, onTokenDetected }: StampScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
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
      // Contexto inseguro: getUserMedia no existe en absoluto en ese caso
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("La cámara solo funciona en conexiones seguras (https). Contacta al administrador del sitio.");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Este navegador no soporta acceso a la cámara.");
        return;
      }

      try {
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
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });

        async function tick() {
          if (cancelled || !video || !canvas || !ctx) return;

          // Snapshot del frame actual a canvas: más compatible entre
          // navegadores que pasar el <video> en vivo al detector.
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            try {
              const codes = await detector.detect(canvas);
              const raw = codes[0]?.rawValue;
              if (raw) {
                const token = extractToken(raw);
                if (token) {
                  onTokenDetected(token);
                  return; // deja de escanear tras un hit
                }
              }
            } catch (detectErr) {
              // Se loguea (antes se ignoraba en silencio) para poder
              // diagnosticar fallos reales del detector, no solo frames
              // sin QR visible.
              console.error("[stamp-scanner] Error al detectar el QR:", detectErr);
            }
          }

          rafId.current = requestAnimationFrame(tick);
        }
        rafId.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        console.error("[stamp-scanner] Error al iniciar la cámara:", err);
        const message =
          err instanceof Error && err.name === "NotAllowedError"
            ? "Necesitamos permiso de cámara para escanear el sello."
            : err instanceof Error && err.name === "NotFoundError"
              ? "No encontramos ninguna cámara en este dispositivo."
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
            <canvas ref={canvasRef} className="hidden" />
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
