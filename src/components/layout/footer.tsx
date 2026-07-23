import Link from "next/link";
import { Instagram, Facebook, MapPin, Clock, Phone } from "lucide-react";

export function Footer() {
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
          <div className="mt-5 flex gap-3">
            <a
              href="#"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal-600 transition-colors hover:border-ember-500 hover:text-ember-500"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="#"
              aria-label="Facebook"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-charcoal-600 transition-colors hover:border-ember-500 hover:text-ember-500"
            >
              <Facebook className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow mb-4">Explora</p>
          <ul className="space-y-2 text-sm text-charcoal-200">
            <li><Link href="/menu" className="hover:text-ember-400">Menú</Link></li>
            <li><Link href="/#historia" className="hover:text-ember-400">Nuestra historia</Link></li>
            <li><Link href="/cuenta/recompensas" className="hover:text-ember-400">Recompensas</Link></li>
            <li><Link href="/login" className="hover:text-ember-400">Ingresar</Link></li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Visítanos</p>
          <ul className="space-y-3 text-sm text-charcoal-200">
            <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-ember-500" /> Cra. 12 #34-56, Popayán, Cauca</li>
            <li className="flex gap-2"><Clock className="h-4 w-4 shrink-0 text-ember-500" /> Lun a Dom, 11:00 a.m. – 10:00 p.m.</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-ember-500" /> +57 300 000 0000</li>
          </ul>
        </div>

        <div>
          <p className="eyebrow mb-4">Mapa</p>
          <div className="aspect-video overflow-hidden rounded-xl border border-charcoal-700">
            <iframe
              title="Ubicación La Mordida"
              className="h-full w-full grayscale invert"
              loading="lazy"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-76.63%2C2.43%2C-76.60%2C2.46&layer=mapnik"
            />
          </div>
        </div>
      </div>
      <div className="border-t border-charcoal-700 py-6 text-center text-xs text-charcoal-400">
        © {new Date().getFullYear()} La Mordida. Todos los derechos reservados.
      </div>
    </footer>
  );
}
