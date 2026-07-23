import { prisma } from "@/lib/prisma";
import { ChallengesManager } from "@/components/admin/challenges-manager";

export const dynamic = "force-dynamic";

export default async function AdminChallengesPage() {
  const challenges = await prisma.challenge.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { progress: true } } },
  });

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">DESAFÍOS</h1>
      <p className="mb-6 text-sm text-charcoal-400">Crea retos para motivar a tus clientes a volver más seguido.</p>
      <ChallengesManager challenges={challenges} />
    </div>
  );
}
