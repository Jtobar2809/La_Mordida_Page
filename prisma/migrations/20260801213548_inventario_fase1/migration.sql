-- CreateEnum
CREATE TYPE "UnidadInsumo" AS ENUM ('GRAMOS', 'KILOGRAMOS', 'MILILITROS', 'LITROS', 'UNIDAD');

-- CreateEnum
CREATE TYPE "MovimientoTipo" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "inventarioDescontado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" "UnidadInsumo" NOT NULL,
    "stockActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoUnitario" INTEGER NOT NULL DEFAULT 0,
    "proveedor" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecetaItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecetaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoInsumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" "MovimientoTipo" NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "motivo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insumo_nombre_key" ON "Insumo"("nombre");

-- CreateIndex
CREATE INDEX "Insumo_activo_idx" ON "Insumo"("activo");

-- CreateIndex
CREATE INDEX "RecetaItem_productId_idx" ON "RecetaItem"("productId");

-- CreateIndex
CREATE INDEX "RecetaItem_insumoId_idx" ON "RecetaItem"("insumoId");

-- CreateIndex
CREATE UNIQUE INDEX "RecetaItem_productId_insumoId_key" ON "RecetaItem"("productId", "insumoId");

-- CreateIndex
CREATE INDEX "MovimientoInsumo_insumoId_idx" ON "MovimientoInsumo"("insumoId");

-- CreateIndex
CREATE INDEX "MovimientoInsumo_tipo_idx" ON "MovimientoInsumo"("tipo");

-- CreateIndex
CREATE INDEX "MovimientoInsumo_createdAt_idx" ON "MovimientoInsumo"("createdAt");

-- AddForeignKey
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecetaItem" ADD CONSTRAINT "RecetaItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoInsumo" ADD CONSTRAINT "MovimientoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
