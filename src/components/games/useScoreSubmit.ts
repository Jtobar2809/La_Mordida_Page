"use client";

import * as React from "react";
import { toast } from "sonner";
import { submitGameScoreAction } from "@/actions/games";
import type { GameSlug } from "@/lib/games";

export type SavedAs = { label: string; isGuest: boolean };

/**
 * Envía el puntaje al terminar una partida y devuelve lo necesario para
 * refrescar la tabla de posiciones.
 *
 * Antes cada juego repetía este bloque y lo condicionaba a `session?.user`,
 * de modo que quien no tenía cuenta jugaba sin dejar rastro. Ahora se
 * envía siempre: el servidor resuelve la identidad (usuario registrado o
 * invitado con código irrepetible), así que todos los jugadores entran a
 * la tabla. Los juegos ya no necesitan saber nada de sesiones.
 */
export function useScoreSubmit(game: GameSlug) {
  const [leaderboardKey, setLeaderboardKey] = React.useState(0);
  const [savedAs, setSavedAs] = React.useState<SavedAs | null>(null);

  const submit = React.useCallback(
    (score: number) => {
      submitGameScoreAction({ game, score }).then((result) => {
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        // `data` es opcional en ActionResult, así que solo pintamos la
        // etiqueta si vino; el refresco de la tabla ocurre igual.
        if (result.data) setSavedAs({ label: result.data.playerLabel, isGuest: result.data.isGuest });
        setLeaderboardKey((k) => k + 1);
      });
    },
    [game]
  );

  return { submit, leaderboardKey, savedAs };
}
