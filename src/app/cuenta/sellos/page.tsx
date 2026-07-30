import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getStampCard, STAMPS_REQUIRED } from "@/lib/stamps";
import { StampCardView } from "@/components/dashboard/stamp-card-view";

export default async function StampsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await auth();
  const { token } = await searchParams;

  if (!session?.user) {
    // El QR de mostrador es una acción espontánea: es muy probable que
    // el cliente no tenga sesión iniciada en ese momento. Antes se
    // devolvía null aquí, dejando una página en blanco sin explicación
    // ni forma de continuar — el cliente veía el QR como "roto". Ahora
    // se redirige a login preservando el token en callbackUrl, para que
    // al iniciar sesión vuelva aquí mismo y el sello se reclame solo.
    const callbackUrl = token ? `/cuenta/sellos?token=${encodeURIComponent(token)}` : "/cuenta/sellos";
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const card = await getStampCard(session.user.id);

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
