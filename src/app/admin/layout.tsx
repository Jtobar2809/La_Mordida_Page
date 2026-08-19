import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { requireAdminPage } from "@/lib/guards";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Segunda capa de autorización, independiente del middleware. Ver el
  // comentario de `requireAdminPage` en src/lib/guards.ts.
  await requireAdminPage();

  return (
    <div className="flex min-h-screen bg-charcoal-50 dark:bg-charcoal-900/40">
      <AdminSidebar />
      <div className="flex-1">
        <AdminTopbar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
