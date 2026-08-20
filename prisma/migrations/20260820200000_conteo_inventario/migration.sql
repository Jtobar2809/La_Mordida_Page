-- Toma de inventario física: contar lo que hay y compararlo con lo que el
-- sistema cree tener.
CREATE TYPE "ConteoEstado" AS ENUM ('BORRADOR', 'APLICADO');

CREATE TABLE "ConteoInventario" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "ConteoEstado" NOT NULL DEFAULT 'BORRADOR',
    "notas" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoAt" TIMESTAMP(3),

    CONSTRAINT "ConteoInventario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConteoInventario_codigo_key" ON "ConteoInventario"("codigo");
CREATE INDEX "ConteoInventario_estado_idx" ON "ConteoInventario"("estado");
CREATE INDEX "ConteoInventario_createdAt_idx" ON "ConteoInventario"("createdAt");

CREATE TABLE "ConteoItem" (
    "id" TEXT NOT NULL,
    "conteoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    -- Lo que el sistema creía tener al ABRIR el conteo, congelado. Es lo que
    -- permite contar con el negocio abierto sin que una venta ocurrida durante
    -- el conteo aparezca como faltante.
    "stockSistema" DOUBLE PRECISION NOT NULL,
    -- Null = no se contó este insumo, no se ajusta.
    "stockContado" DOUBLE PRECISION,
    "costoUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ConteoItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConteoItem_conteoId_insumoId_key" ON "ConteoItem"("conteoId", "insumoId");
CREATE INDEX "ConteoItem_conteoId_idx" ON "ConteoItem"("conteoId");
CREATE INDEX "ConteoItem_insumoId_idx" ON "ConteoItem"("insumoId");

ALTER TABLE "ConteoItem" ADD CONSTRAINT "ConteoItem_conteoId_fkey"
    FOREIGN KEY ("conteoId") REFERENCES "ConteoInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConteoItem" ADD CONSTRAINT "ConteoItem_insumoId_fkey"
    FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trazabilidad: de qué conteo salió cada ajuste.
ALTER TABLE "MovimientoInsumo" ADD COLUMN "conteoId" TEXT;
CREATE INDEX "MovimientoInsumo_conteoId_idx" ON "MovimientoInsumo"("conteoId");
