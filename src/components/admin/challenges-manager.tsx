"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ChallengeForm } from "@/components/admin/challenge-form";
import { deleteChallenge, toggleChallengeActive } from "@/actions/admin/challenges";
import type { Challenge } from "@prisma/client";

export function ChallengesManager({ challenges }: { challenges: (Challenge & { _count: { progress: number } })[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Challenge | null | undefined>(undefined);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar el desafío "${title}"?`)) return;
    const result = await deleteChallenge(id);
    if (!result.success) return toast.error(result.error);
    toast.success("Desafío eliminado");
    router.refresh();
  };

  const handleToggle = async (id: string, current: boolean) => {
    const result = await toggleChallengeActive(id, !current);
    if (!result.success) return toast.error(result.error);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing(null)}>
          <Plus className="h-4 w-4" /> Nuevo desafío
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {challenges.map((challenge) => (
          <Card key={challenge.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-gradient text-white">
                <Trophy className="h-5 w-5" />
              </div>
              <button onClick={() => handleToggle(challenge.id, challenge.active)}>
                <Badge variant={challenge.active ? "olive" : "charcoal"}>{challenge.active ? "Activo" : "Pausado"}</Badge>
              </button>
            </div>
            <h3 className="mt-3 font-display text-xl tracking-wide text-charcoal-900 dark:text-cream">{challenge.title}</h3>
            <p className="mt-1 text-sm text-charcoal-500 dark:text-charcoal-300">{challenge.description}</p>
            <p className="mt-2 text-xs text-charcoal-400">
              Meta: {challenge.goal} · Premio: {challenge.rewardPoints} pts · {challenge._count.progress} cliente(s) en progreso
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="icon" variant="ghost" onClick={() => setEditing(challenge)} aria-label="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(challenge.id, challenge.title)} aria-label="Eliminar">
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? "Editar desafío" : "Nuevo desafío"}>
        <ChallengeForm
          challenge={editing ?? null}
          onDone={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}
