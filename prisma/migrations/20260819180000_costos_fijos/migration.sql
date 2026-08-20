-- Costos fijos mensuales: lo que se paga así no se venda nada.
CREATE TYPE "CostoFijoCategoria" AS ENUM ('ARRIENDO', 'SERVICIOS', 'MANO_DE_OBRA', 'ADMINISTRATIVO', 'OTRO');

CREATE TABLE "CostoFijo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "categoria" "CostoFijoCategoria" NOT NULL DEFAULT 'OTRO',
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostoFijo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CostoFijo_nombre_key" ON "CostoFijo"("nombre");
CREATE INDEX "CostoFijo_activo_idx" ON "CostoFijo"("activo");
