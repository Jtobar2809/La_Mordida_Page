import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">CONFIGURACIÓN</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
