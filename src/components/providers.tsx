"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { CartProvider } from "@/hooks/use-cart";
import { SettingsProvider, type SiteSettings } from "@/hooks/use-settings";

export function Providers({ children, settings }: { children: React.ReactNode; settings: SiteSettings }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <SettingsProvider settings={settings}>
          <CartProvider>
            {children}
            <Toaster position="bottom-center" richColors closeButton />
          </CartProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
