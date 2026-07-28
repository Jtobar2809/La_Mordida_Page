"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { redeemRewardAction } from "@/actions/loyalty";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  stock: number | null;
  image?: string | null;
};

export function RewardsGrid({ rewards, userPoints }: { rewards: Reward[]; userPoints: number }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  const handleRedeem = async (reward: Reward) => {
    if (!confirm(`¿Canjear "${reward.name}" por ${reward.pointsCost} puntos?`)) return;
    setLoadingId(reward.id);
    const result = await redeemRewardAction(reward.id);
    setLoadingId(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(`¡Listo! Muestra el código ${result.data?.code} en caja para reclamarlo.`);
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {rewards.map((reward) => {
        const canAfford = userPoints >= reward.pointsCost;
        const outOfStock = reward.stock !== null && reward.stock <= 0;
        return (
          <Card key={reward.id} className="flex flex-col p-5">
            {reward.image ? (
              <div className="relative -m-5 mb-1 h-32 overflow-hidden rounded-t-2xl">
                <Image src={reward.image} alt={reward.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ember-gradient text-white">
                <Gift className="h-6 w-6" />
              </div>
            )}
            <h3 className="mt-4 font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">{reward.name}</h3>
            {reward.description && <p className="mt-1 flex-1 text-sm text-charcoal-500 dark:text-charcoal-300">{reward.description}</p>}
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono font-bold text-ember-600">{reward.pointsCost} pts</span>
              <Button
                size="sm"
                disabled={!canAfford || outOfStock || loadingId === reward.id}
                onClick={() => handleRedeem(reward)}
              >
                {outOfStock ? "Agotado" : loadingId === reward.id ? "Canjeando..." : canAfford ? "Canjear" : "Puntos insuficientes"}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
