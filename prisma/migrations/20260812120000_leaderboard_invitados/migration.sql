-- Invitados en la tabla de posiciones.
--
-- Antes GameSession.userId era obligatorio, así que solo los usuarios
-- registrados podían aparecer en el leaderboard. Ahora una partida puede
-- pertenecer a un invitado identificado por un código público
-- irrepetible (guestCode). `playerKey` es la clave de agrupación del
-- leaderboard: "u:<userId>" para registrados, "g:<guestCode>" para
-- invitados — de ese modo el ranking sigue siendo un solo GROUP BY.

-- 0. Identidad de invitado. El código es la PK: Postgres garantiza que
--    dos invitados nunca compartan código.
CREATE TABLE "GuestPlayer" (
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestPlayer_pkey" PRIMARY KEY ("code")
);

-- 1. Columnas nuevas (playerKey entra nullable para poder rellenar las filas existentes)
ALTER TABLE "GameSession" ADD COLUMN "playerKey" TEXT;
ALTER TABLE "GameSession" ADD COLUMN "guestCode" TEXT;

-- 2. Backfill: toda partida existente es de un usuario registrado
UPDATE "GameSession" SET "playerKey" = 'u:' || "userId" WHERE "playerKey" IS NULL;

-- 3. Ahora sí, obligatoria
ALTER TABLE "GameSession" ALTER COLUMN "playerKey" SET NOT NULL;

-- 4. userId pasa a opcional; la FK se recrea con ON DELETE SET NULL para
--    que borrar un usuario no borre el historial del leaderboard.
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_userId_fkey";
ALTER TABLE "GameSession" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Índices para las consultas del leaderboard
CREATE INDEX "GameSession_game_playerKey_idx" ON "GameSession"("game", "playerKey");
CREATE INDEX "GameSession_guestCode_idx" ON "GameSession"("guestCode");
