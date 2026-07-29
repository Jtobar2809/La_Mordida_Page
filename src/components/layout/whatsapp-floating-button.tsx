"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle } from "lucide-react";
import { buildWhatsappLink } from "@/lib/whatsapp";

const WELCOME_MESSAGE = "¡Hola! 👋 Quiero hacer un pedido en La Mordida.";
const BUBBLE_DELAY_MS = 2500; // tiempo antes de mostrar el globo de bienvenida
const BUBBLE_AUTOHIDE_MS = 9000; // se oculta solo si nadie interactúa

/**
 * Botón flotante de WhatsApp, visible en todo el sitio. Usa el mismo
 * generador de link (wa.me) que el checkout — no hay integración de
 * API de WhatsApp, es un enlace directo a una conversación con un
 * mensaje pre-escrito. El número viene de Settings.whatsappNumber
 * (editable en /admin/configuración), resuelto en el servidor y
 * pasado como prop para no exponer lógica de base de datos al cliente.
 */
export function WhatsAppFloatingButton({ phoneNumber }: { phoneNumber: string }) {
  const pathname = usePathname();
  const [showBubble, setShowBubble] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  const href = buildWhatsappLink(phoneNumber, WELCOME_MESSAGE);
  const isAdminRoute = pathname?.startsWith("/admin");

  React.useEffect(() => {
    if (isAdminRoute) return;
    const showTimer = setTimeout(() => {
      if (!dismissed) setShowBubble(true);
    }, BUBBLE_DELAY_MS);
    return () => clearTimeout(showTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminRoute]);

  React.useEffect(() => {
    if (!showBubble) return;
    const hideTimer = setTimeout(() => setShowBubble(false), BUBBLE_AUTOHIDE_MS);
    return () => clearTimeout(hideTimer);
  }, [showBubble]);

  function handleDismissBubble(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setShowBubble(false);
    setDismissed(true);
  }

  // No mostrar en el panel admin: es una herramienta interna, no una
  // página de cara al cliente que necesite un canal de contacto directo.
  if (isAdminRoute) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      <AnimatePresence>
        {showBubble && (
          <motion.a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="relative max-w-[240px] rounded-2xl rounded-br-sm bg-white p-4 pr-7 text-sm text-charcoal-700 shadow-premium dark:bg-charcoal-800 dark:text-charcoal-100"
          >
            <button
              onClick={handleDismissBubble}
              aria-label="Cerrar mensaje"
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-charcoal-400 hover:bg-charcoal-100 hover:text-charcoal-600 dark:hover:bg-charcoal-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="font-semibold text-charcoal-900 dark:text-cream">¿Antojo de una Mordida? 🍔</p>
            <p className="mt-1 text-charcoal-500 dark:text-charcoal-300">Escríbenos por WhatsApp, respondemos rápido.</p>
          </motion.a>
        )}
      </AnimatePresence>

      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribir por WhatsApp"
        onClick={() => setDismissed(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-40" />
        <MessageCircle className="relative h-7 w-7" fill="white" strokeWidth={0} />
      </motion.a>
    </div>
  );
}
