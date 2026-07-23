import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
