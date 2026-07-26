"use client";

import * as React from "react";
import { toast } from "sonner";
import { Gift, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { markStampRewardDeliveredAction } from "@/actions/stamps";

type ReadyCard = {
  id: string;
  cardsCompleted: number;
  updatedAt: Date;
  user: { name: string | null; email: string | null; phone: string | null };
};

/** Tabla de clientes con tarjeta completa (7/7), esperando que se les entregue la hamburguesa gratis */
export function StampRewardsTable({ cards }: { cards: ReadyCard[] }) {
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [delivered, setDelivered] = React.useState<Set<string>>(new Set());

  async function markDelivered(id: string) {
    setProcessingId(id);
    const result = await markStampRewardDeliveredAction(id);
    setProcessingId(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Recompensa marcada como entregada");
    setDelivered((prev) => new Set(prev).add(id));
  }

  const visibleCards = cards.filter((c) => !delivered.has(c.id));

  if (visibleCards.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-charcoal-400">
        No hay recompensas pendientes por entregar en este momento.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {visibleCards.map((card) => (
        <Card key={card.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mustard-400/15 text-mustard-500">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-charcoal-900 dark:text-cream">{card.user.name ?? "Cliente"}</p>
              <p className="text-xs text-charcoal-400">
                {card.user.email ?? card.user.phone ?? "Sin contacto"} · Tarjeta #{card.cardsCompleted} completada{" "}
                {formatDateTime(card.updatedAt)}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => markDelivered(card.id)}
            disabled={processingId === card.id}
          >
            <Check className="h-4 w-4" />
            {processingId === card.id ? "Guardando..." : "Marcar entregada"}
          </Button>
        </Card>
      ))}
    </div>
  );
}
