"use client";

import Link from "next/link";
import { Instagram, Facebook, MapPin, Clock, Phone, Navigation } from "lucide-react";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { useSettings } from "@/hooks/use-settings";

const FOOTER_WHATSAPP_MESSAGE = "¡Hola! 👋\n¡Quiero pedir en la mordida!!";

export function Footer() {
  // Los settings ya vienen del servidor vía <SettingsProvider> (ver
  // src/app/layout.tsx). Antes este componente hacía su propio
  // fetch("/api/settings") en cada montaje, duplicando consultas a la
  // base de datos en cada navegación y agotando el connection pool de
  // Prisma (P2024 "Timed out fetching a new connection").
  const s = useSettings();

  const address = "La Mordida Popayán | Hamburguesas Popayán, Popayán, Cauca, Colombia";
  const mapEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&hl=es&z=17&output=embed`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  const whatsappLink = buildWhatsappLink(s.whatsappNumber, FOOTER_WHATSAPP_MESSAGE);

  return (
    <footer className="border-t border-charcoal-700 bg-charcoal-900 text-cream" id="contacto">
      <div className="container-lm grid grid-cols-1 gap-10 py-16 md:grid-cols-4">
        <div>
          <p className="font-display text-3xl">
            LA <span className="text-ember-500">MORDIDA</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-charcoal-200">
            Hamburguesas y perros calientes artesanales. Carnes e ingredientes frescos, preparación 100% artesanal,
            hechos para morder sin culpa.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="https://www.instagram.com/lamordidapopayan/"
              aria-label="Instagram - @lamordidapopayan"
              title="Instagram - @lamordidapopayan"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 whitespace-nowrap rounded-full border border-charcoal-600 px-3 py-2 transition-colors hover:border-ember-500 hover:text-ember-500"
            >
              <Instagram className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">@lamordidapopayan</span>
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61592053178769"
              aria-label="Facebook - La Mordida"
              title="Facebook - La Mordida"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 whitespace-nowrap rounded-full border border-charcoal-600 px-3 py-2 transition-colors hover:border-ember-500 hover:text-ember-500"
            >
              <Facebook className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">La Mordida</span>
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-4">Explora</p>
          <ul className="space-y-2 text-sm text-charcoal-200">
            <li><Link href="/menu" className="hover:text-ember-400">Menú</Link></li>
            <li><Link href="/#historia" className="hover:text-ember-400">Nuestra historia</Link></li>
            <li><Link href="/cuenta/sellos" className="hover:text-ember-400">Tarjeta de sellos</Link></li>
            <li><Link href="/login" className="hover:text-ember-400">Ingresar</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Visítanos</p>
          <ul className="space-y-3 text-sm text-charcoal-200">
            <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-ember-500" /> {s.storeAddress}</li>
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-fit items-center gap-2 rounded-full bg-ember-gradient px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-105"
            >
              <Navigation className="h-4 w-4" /> Cómo llegar
            </a>
            <li className="flex gap-2"><Clock className="h-4 w-4 shrink-0 text-ember-500" /> {s.storeSchedule}</li>
            <li className="flex gap-2">
              <Phone className="h-4 w-4 shrink-0 text-ember-500" />
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-ember-400">
                +{s.whatsappNumber}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Mapa</p>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-video overflow-hidden rounded-xl border border-charcoal-700"
            aria-label="Abrir ubicación en Google Maps"
          >
            <iframe
              title="Ubicación de La Mordida"
              className="h-full w-full pointer-events-none"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={mapEmbedSrc}
            />
          </a>
        </div>
      </div>
      <div className="border-t border-charcoal-700 py-6 text-center text-xs text-charcoal-400">
        © {new Date().getFullYear()} La Mordida. Todos los derechos reservados.
      </div>
    </footer>
  );
}
