import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AccountSidebar } from "@/components/dashboard/account-sidebar";
import { requireUserPage } from "@/lib/guards";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Igual que en /admin: el middleware ya protege esta rama, pero la sesión se
  // vuelve a exigir en el servidor para no depender de una sola capa.
  await requireUserPage();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-charcoal-50 dark:bg-charcoal-900/40">
        <div className="container-lm grid grid-cols-1 gap-8 py-12 lg:grid-cols-[220px_1fr]">
          <AccountSidebar />
          <div>{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
