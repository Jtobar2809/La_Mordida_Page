"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Stamp, Sparkles, Camera, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { claimStampAction } from "@/actions/stamps";
import { StampScanner } from "@/components/dashboard/stamp-scanner";
import { cn } from "@/lib/utils";

interface StampCardViewProps {
  initialStamps: number;
  stampsRequired: number;
  cardsCompleted: number;
  rewardReady: boolean;
  initialTokenFromUrl: string | null;
}

/**
 * Tarjeta visual de sellos + orquestación del reclamo. Dos formas de
 * reclamar un sello:
 *  1. Deep-link: el QR del admin codifica esta misma URL con ?token=...
 *     — al cargar la página, si hay token en la URL, se reclama solo.
 *  2. Botón "Escanear": abre la cámara del dispositivo (StampScanner)
 *     para cuando el cliente ya está en esta página y solo necesita
 *     apuntar la cámara al QR en el mostrador.
 * El sello nuevo se anima como un "golpe de sello de tinta" (aparece
 * grande y rotado, y hace resorte hasta su tamaño final) — no un simple
 * fade, para que se sienta como un sello físico estampándose.
 */
export function StampCardView({
  initialStamps,
  stampsRequired,
  cardsCompleted,
  rewardReady,
  initialTokenFromUrl,
}: StampCardViewProps) {
  const [stamps, setStamps] = React.useState(initialStamps);
  const [completedCount, setCompletedCount] = React.useState(cardsCompleted);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [claiming, setClaiming] = React.useState(false);
  const [justStampedIndex, setJustStampedIndex] = React.useState<number | null>(null);

  const processedTokens = React.useRef<Set<string>>(new Set());

  const claim = React.useCallback(async (token: string) => {
    if (processedTokens.current.has(token)) return;
    processedTokens.current.add(token);

    setClaiming(true);
    const result = await claimStampAction({ token });
    setClaiming(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (!result.data) {
      toast.error("No se pudo reclamar el sello.");
      return;
    }

    const { currentStamps, cardCompleted } = result.data;

    if (cardCompleted) {
      setJustStampedIndex(stampsRequired - 1);
      setTimeout(() => {
        setStamps(0);
        setCompletedCount((c) => c + 1);
        setShowCelebration(true);
        setJustStampedIndex(null);
      }, 700);
    } else {
      setJustStampedIndex(currentStamps - 1);
      setStamps(currentStamps);
      toast.success("¡Sello agregado!");
      setTimeout(() => setJustStampedIndex(null), 900);
    }
  }, [stampsRequired]);

  // Reclamo automático si la página se abrió vía el deep-link del QR
  React.useEffect(() => {
    if (initialTokenFromUrl) {
      claim(initialTokenFromUrl);
      // Limpia el token de la URL para que un refresh no reintente el reclamo
      window.history.replaceState(null, "", "/cuenta/sellos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {rewardReady && (
        <Card className="flex items-center gap-3 border-mustard-400/40 bg-mustard-400/10 p-4">
          <PartyPopper className="h-6 w-6 shrink-0 text-mustard-500" />
          <p className="text-sm font-semibold text-charcoal-800 dark:text-cream">
            ¡Tienes una hamburguesa gratis esperando! Muestra esta pantalla en caja para reclamarla.
          </p>
        </Card>
      )}

      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">
              {stamps} / {stampsRequired} sellos
            </p>
            <p className="text-xs text-charcoal-400">
              {completedCount > 0
                ? `Ya has completado ${completedCount} tarjeta${completedCount === 1 ? "" : "s"}`
                : "Completa tu primera tarjeta"}
            </p>
          </div>
          <Button onClick={() => setScannerOpen(true)} disabled={claiming}>
            <Camera className="h-4 w-4" />
            Escanear sello
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {Array.from({ length: stampsRequired }).map((_, i) => {
            const filled = i < stamps;
            const isJustStamped = i === justStampedIndex;
            return (
              <div
                key={i}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-full border-2 border-dashed",
                  filled
                    ? "border-ember-500 bg-ember-500/5"
                    : "border-charcoal-200 dark:border-charcoal-600"
                )}
              >
                <AnimatePresence>
                  {filled && (
                    <motion.div
                      key={`stamp-${i}`}
                      initial={
                        isJustStamped
                          ? { scale: 2.2, opacity: 0, rotate: -25 }
                          : { scale: 1, opacity: 1, rotate: -8 }
                      }
                      animate={{ scale: 1, opacity: 1, rotate: -8 }}
                      transition={
                        isJustStamped
                          ? { type: "spring", stiffness: 400, damping: 12 }
                          : { duration: 0 }
                      }
                      className="flex h-full w-full items-center justify-center rounded-full bg-ember-gradient text-white shadow-glow"
                    >
                      <Stamp className="h-1/2 w-1/2" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {!filled && <span className="text-xs text-charcoal-300 dark:text-charcoal-600">{i + 1}</span>}
              </div>
            );
          })}
        </div>
      </Card>

      <StampScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onTokenDetected={(token) => {
          setScannerOpen(false);
          claim(token);
        }}
      />

      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal-900/70 p-4 backdrop-blur-sm"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-sm rounded-3xl bg-cream p-8 text-center shadow-2xl dark:bg-charcoal-800"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-mustard-400/20 text-mustard-500"
              >
                <Sparkles className="h-10 w-10" />
              </motion.div>
              <h2 className="font-display text-2xl tracking-wide text-charcoal-900 dark:text-cream">
                ¡TARJETA COMPLETA!
              </h2>
              <p className="mt-2 text-sm text-charcoal-500 dark:text-charcoal-300">
                Ganaste una hamburguesa gratis. Muestra esta pantalla en caja la próxima vez que nos visites.
              </p>
              <Button onClick={() => setShowCelebration(false)} size="lg" className="mt-6 w-full">
                ¡Genial!
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
