-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "esElaborado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InsumoComponente" (
    "id" TEXT NOT NULL,
    "insumoElaboradoId" TEXT NOT NULL,
    "insumoBaseId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsumoComponente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsumoComponente_insumoElaboradoId_idx" ON "InsumoComponente"("insumoElaboradoId");

-- CreateIndex
CREATE INDEX "InsumoComponente_insumoBaseId_idx" ON "InsumoComponente"("insumoBaseId");

-- CreateIndex
CREATE UNIQUE INDEX "InsumoComponente_insumoElaboradoId_insumoBaseId_key" ON "InsumoComponente"("insumoElaboradoId", "insumoBaseId");

-- AddForeignKey
ALTER TABLE "InsumoComponente" ADD CONSTRAINT "InsumoComponente_insumoElaboradoId_fkey" FOREIGN KEY ("insumoElaboradoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsumoComponente" ADD CONSTRAINT "InsumoComponente_insumoBaseId_fkey" FOREIGN KEY ("insumoBaseId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
