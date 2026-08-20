-- Contador de intentos para frenar el abuso de las acciones públicas.
-- En Postgres y no en memoria porque en Vercel cada petición puede caer en una
-- instancia distinta: un contador en memoria se reinicia solo y no limita nada.
CREATE TABLE "RateLimit" (
    "clave" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ventanaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("clave")
);

CREATE INDEX "RateLimit_ventanaAt_idx" ON "RateLimit"("ventanaAt");
