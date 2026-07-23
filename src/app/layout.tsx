import type { Metadata } from "next";
import { Bebas_Neue, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
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

const siteUrl = process.env.NEXTAUTH_URL ?? "https://lamordida.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "La Mordida — Hamburguesas y perros artesanales",
    template: "%s · La Mordida",
  },
  description:
    "Hamburguesas y perros calientes artesanales, preparados con carnes e ingredientes frescos y naturales. Pide en línea y gana puntos con cada mordida.",
  keywords: ["hamburguesas artesanales", "perros calientes", "comida rápida gourmet", "La Mordida", "restaurante"],
  openGraph: {
    title: "La Mordida — Hamburguesas y perros artesanales",
    description: "Carnes e ingredientes frescos, preparación 100% artesanal. Pide en línea y acumula puntos.",
    url: siteUrl,
    siteName: "La Mordida",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "La Mordida — Hamburguesas y perros artesanales",
    description: "Carnes e ingredientes frescos, preparación 100% artesanal.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body className="font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
