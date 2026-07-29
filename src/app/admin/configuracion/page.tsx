import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <Navbar />
      <main className="container-lm py-12">
        <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CONFIGURACIÓN</h1>
        <p className="mb-6 text-sm text-charcoal-400">Ajustes generales del sitio y toggles de funcionalidades.</p>
        <div className="max-w-xl">
          <SettingsForm settings={settings} />
        </div>
      </main>
      <Footer />
    </>
  );
}
