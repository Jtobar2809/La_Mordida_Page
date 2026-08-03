-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "fechaVencimiento" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MovimientoInsumo" ADD COLUMN     "orderId" TEXT;

-- CreateIndex
CREATE INDEX "MovimientoInsumo_orderId_idx" ON "MovimientoInsumo"("orderId");
