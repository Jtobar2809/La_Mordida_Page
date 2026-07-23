"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { RewardForm } from "@/components/admin/reward-form";
import { deleteReward } from "@/actions/admin/rewards";
import type { Reward } from "@prisma/client";

export function RewardsManager({ rewards }: { rewards: Reward[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Reward | null | undefined>(undefined);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    const result = await deleteReward(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Recompensa eliminada");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nueva recompensa
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => (
          <Card key={reward.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-gradient text-white">
                <Gift className="h-5 w-5" />
              </div>
              <Badge variant={reward.active ? "olive" : "charcoal"}>{reward.active ? "Visible" : "Oculta"}</Badge>
            </div>
            <h3 className="mt-3 font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">{reward.name}</h3>
            {reward.description && <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">{reward.description}</p>}
            <p className="mt-2 font-mono font-bold text-ember-600">{reward.pointsCost} pts</p>
            <p className="text-xs text-charcoal-400">{reward.stock === null ? "Stock ilimitado" : `${reward.stock} disponibles`}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="icon" variant="ghost" onClick={() => setEditing(reward)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(reward.id, reward.name)} aria-label="Eliminar">
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "Editar recompensa" : "Nueva recompensa"}>
        <RewardForm
          reward={editing ?? null}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
