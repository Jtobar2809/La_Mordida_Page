"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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
        <WhatsAppIcon className="relative h-8 w-8" />
      </motion.a>
    </div>
  );
}

/** Glifo oficial de WhatsApp (teléfono dentro de burbuja de chat), en vez de un ícono genérico de chat */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.004 3C9.377 3 4 8.373 4 15c0 2.34.66 4.523 1.803 6.383L4 29l7.822-1.76A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm6.964 16.845c-.297.833-1.47 1.53-2.402 1.727-.638.134-1.47.24-4.27-.918-3.582-1.483-5.89-5.098-6.07-5.335-.174-.238-1.462-1.946-1.462-3.71 0-1.766.9-2.63 1.23-2.988.297-.323.647-.404.863-.404.216 0 .432.003.62.012.216.01.474-.075.74.567.297.71.99 2.475 1.076 2.657.087.183.14.398.028.643-.109.244-.163.397-.324.61-.163.213-.34.475-.487.638-.163.183-.333.38-.14.712.19.33.848 1.4 1.82 2.267 1.25 1.117 2.302 1.463 2.632 1.627.33.163.523.137.716-.084.19-.22.813-.945 1.03-1.27.216-.324.433-.27.727-.163.297.11 1.878.886 2.202 1.048.324.163.54.244.618.38.078.137.078.79-.22 1.622Z" />
    </svg>
  );
}
