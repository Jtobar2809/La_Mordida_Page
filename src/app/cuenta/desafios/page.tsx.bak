import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Trophy, CheckCircle2 } from "lucide-react";

export default async function ChallengesPage() {
  const session = await auth();
  if (!session?.user) return null;

  const challenges = await prisma.challenge.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: {
      progress: { where: { userId: session.user.id } },
    },
  });

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">DESAFÍOS</h1>
      <p className="mb-6 text-sm text-charcoal-400">Completa retos y gana puntos e insignias extra.</p>

      {challenges.length === 0 ? (
        <Card className="p-6 text-center text-sm text-charcoal-400">No hay desafíos activos en este momento.</Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {challenges.map((challenge) => {
            const progress = challenge.progress[0];
            const current = progress?.progress ?? 0;
            const completed = progress?.completed ?? false;
            const pct = Math.min(100, Math.round((current / challenge.goal) * 100));

            return (
              <Card key={challenge.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-gradient text-white">
                    <Trophy className="h-5 w-5" />
                  </div>
                  {completed && <CheckCircle2 className="h-6 w-6 text-olive-500" />}
                </div>
                <h3 className="mt-3 font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">{challenge.title}</h3>
                <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">{challenge.description}</p>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-charcoal-400">
                    <span>{Math.min(current, challenge.goal)} / {challenge.goal}</span>
                    <span>+{challenge.rewardPoints} pts</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-charcoal-100 dark:bg-charcoal-700">
                    <div
                      className={`h-full rounded-full transition-all ${completed ? "bg-olive-500" : "bg-ember-gradient"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
