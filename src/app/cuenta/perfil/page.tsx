import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/dashboard/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">MI PERFIL</h1>
      <ProfileForm user={{ name: user.name ?? "", email: user.email ?? "", phone: user.phone ?? "", address: user.address ?? "", birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : "" }} />
    </div>
  );
}
