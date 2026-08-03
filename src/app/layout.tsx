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
    default: "La Mordida",
    template: "%s | La Mordida",
  },

  description:
    "Hamburguesas y perros calientes artesanales en Popayán. Pide en línea y acumula puntos con cada compra.",

  metadataBase: new URL(siteUrl),

  openGraph: {
    title: "La Mordida",
    description:
      "Hamburguesas y perros calientes artesanales en Popayán.",
    url: siteUrl,
    siteName: "La Mordida",
    locale: "es_CO",
    type: "website",

    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "La Mordida",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "La Mordida",
    description:
      "Hamburguesas y perros calientes artesanales en Popayán.",

    images: ["/og-image.jpg"],
  },

  icons: {
    icon: [{ url: "/logo_LaMordida.jpg", type: "image/jpeg" }],
    apple: [{ url: "/logo_LaMordida.jpg", type: "image/jpeg" }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="font-body">
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
