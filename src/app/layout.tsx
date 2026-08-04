import type { Metadata } from "next";
import { Bebas_Neue, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { VisualHelpers } from "@/components/VisualHelpers";
import { WhatsAppFloatingButton } from "@/components/layout/whatsapp-floating-button";
import { getSettings } from "@/lib/settings";
import "./globals.css";
const display = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl = process.env.NEXTAUTH_URL ?? "https://la-mordida.vercel.app";


export const metadata: Metadata = {
  title: {
    default: "La Mordida | Hamburguesas y Comida Rápida en Popayán",
    template: "%s | La Mordida",
  },

  description:
    "Hamburguesas y perros calientes artesanales en Popayán, Cauca. Comida rápida a domicilio: pide en línea, acumula puntos y canjea recompensas con cada mordida.",

  keywords: [
    "hamburguesas Popayán",
    "comida rápida Popayán",
    "perros calientes Popayán",
    "domicilios Popayán",
    "hamburguesas artesanales Popayán",
    "restaurante Popayán",
    "comida rápida a domicilio Popayán",
    "La Mordida",
  ],

  metadataBase: new URL(siteUrl),

  alternates: {
    canonical: "/",
  },

  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },

  openGraph: {
    title: "La Mordida | Hamburguesas y Comida Rápida en Popayán",
    description:
      "Hamburguesas y perros calientes artesanales en Popayán, Cauca. Pide en línea y acumula puntos con cada mordida.",
    url: siteUrl,
    siteName: "La Mordida",
    locale: "es_CO",
    type: "website",

    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Hamburguesas artesanales La Mordida en Popayán",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "La Mordida | Hamburguesas y Comida Rápida en Popayán",
    description:
      "Hamburguesas y perros calientes artesanales en Popayán, Cauca.",

    images: ["/og-image.jpg"],
  },

  icons: {
    icon: [{ url: "/logo_LaMordida.jpg", type: "image/jpeg" }],
    apple: [{ url: "/logo_LaMordida.jpg", type: "image/jpeg" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  // Datos estructurados (Schema.org) para que Google entienda que somos un
  // restaurante local en Popayán: habilita el rich snippet con dirección,
  // horario, teléfono y rating en los resultados de búsqueda y Google Maps.
  const restaurantJsonLd = {
    "@context": "https://schema.org",
    "@type": "FastFoodRestaurant",
    "@id": `${siteUrl}/#restaurante`,
    name: "La Mordida",
    image: `${siteUrl}/og-image.jpg`,
    url: siteUrl,
    telephone: `+${settings.whatsappNumber}`,
    priceRange: "$$",
    servesCuisine: ["Hamburguesas", "Comida rápida", "Perros calientes"],
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.storeAddress,
      addressLocality: "Popayán",
      addressRegion: "Cauca",
      addressCountry: "CO",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: settings.storeLat,
      longitude: settings.storeLng,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "17:00",
        closes: "22:00",
      },
    ],
    menu: `${siteUrl}/menu`,
    acceptsReservations: "False",
    sameAs: [
      "https://www.instagram.com/lamordidapopayan/",
      "https://www.facebook.com/profile.php?id=61592053178769",
    ],
  };

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="font-body">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd) }}
        />
        <VisualHelpers>
          <Providers settings={settings}>
            {children}
          </Providers>
        </VisualHelpers>
        <WhatsAppFloatingButton phoneNumber={settings.whatsappNumber} />
      </body>
    </html>
  );
}
