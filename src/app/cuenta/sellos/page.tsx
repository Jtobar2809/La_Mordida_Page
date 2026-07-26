import { auth } from "@/auth";
import { getStampCard, STAMPS_REQUIRED } from "@/lib/stamps";
import { StampCardView } from "@/components/dashboard/stamp-card-view";

export default async function StampsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const [{ token }, card] = await Promise.all([searchParams, getStampCard(session.user.id)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide text-charcoal-900 dark:text-cream">TARJETA DE SELLOS</h1>
        <p className="mt-1 text-sm text-charcoal-400">
          Junta {STAMPS_REQUIRED} sellos y gana una hamburguesa gratis. Pide tu sello en caja después de cada
          compra.
        </p>
      </div>

      <StampCardView
        initialStamps={card.currentStamps}
        stampsRequired={STAMPS_REQUIRED}
        cardsCompleted={card.cardsCompleted}
        rewardReady={card.rewardReady}
        initialTokenFromUrl={token ?? null}
      />
    </div>
  );
}
