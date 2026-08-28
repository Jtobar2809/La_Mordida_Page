-- El Nequi por fin tiene saldo.
--
-- Hasta ahora el celular solo tenía `totalNequi` por turno: cuánto ENTRÓ. Nunca
-- se le restaba nada, no se arrastraba saldo entre turnos y nadie lo comparaba
-- contra la app. Un gasto pagado por Nequi salía de la plata real sin que
-- ningún renglón se enterara.
--
-- Este arqueo hace con el celular lo que `efectivoContado` hace con el cajón,
-- con una diferencia obligada: el cajón se cuenta al cerrar el turno y vuelve a
-- una base, mientras que el saldo de Nequi es acumulado y no se reinicia nunca.
-- Por eso el conteo es un evento con su propia fecha.
--
-- Cada arqueo REANCLA el saldo: a partir de él se cuenta desde `saldoReal`. Sin
-- eso, un descuadre que ya se verificó a mano seguiría restando para siempre.

CREATE TABLE "ArqueoNequi" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saldoEsperado" INTEGER NOT NULL,
    "saldoReal" INTEGER NOT NULL,
    "diferencia" INTEGER NOT NULL,
    "notas" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArqueoNequi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArqueoNequi_fecha_idx" ON "ArqueoNequi"("fecha");
