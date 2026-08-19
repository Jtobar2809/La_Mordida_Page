-- CreateEnum
CREATE TYPE "CajaEstado" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "MovimientoCajaTipo" AS ENUM ('VENTA', 'INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'NEQUI', 'OTRO');

-- CreateEnum
CREATE TYPE "OrderCanal" AS ENUM ('WEB', 'CAJA');

-- AlterEnum
ALTER TYPE "MovimientoTipo" ADD VALUE 'PRODUCCION';

-- AlterTable
ALTER TABLE "ProductExtra" ADD COLUMN     "cantidadInsumo" DOUBLE PRECISION,
ADD COLUMN     "insumoId" TEXT;

-- AlterTable
ALTER TABLE "MovimientoInsumo" ADD COLUMN     "produccionId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cajaSesionId" TEXT,
ADD COLUMN     "cambio" INTEGER,
ADD COLUMN     "canal" "OrderCanal" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "efectivoRecibido" INTEGER,
ADD COLUMN     "metodoPago" "MetodoPago";

-- CreateTable
CREATE TABLE "Produccion" (
    "id" TEXT NOT NULL,
    "insumoElaboradoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costoUnitario" INTEGER NOT NULL DEFAULT 0,
    "notas" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CajaSesion" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "CajaEstado" NOT NULL DEFAULT 'ABIERTA',
    "montoInicial" INTEGER NOT NULL DEFAULT 0,
    "abiertaPorId" TEXT NOT NULL,
    "abiertaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notasApertura" TEXT,
    "cerradaPorId" TEXT,
    "cerradaAt" TIMESTAMP(3),
    "notasCierre" TEXT,
    "efectivoContado" INTEGER,
    "totalVentas" INTEGER,
    "totalEfectivo" INTEGER,
    "totalNequi" INTEGER,
    "totalOtros" INTEGER,
    "totalIngresos" INTEGER,
    "totalEgresos" INTEGER,
    "esperadoEfectivo" INTEGER,
    "diferencia" INTEGER,
    "abiertaLock" BOOLEAN,

    CONSTRAINT "CajaSesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "tipo" "MovimientoCajaTipo" NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "monto" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "orderId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Produccion_insumoElaboradoId_idx" ON "Produccion"("insumoElaboradoId");

-- CreateIndex
CREATE INDEX "Produccion_createdAt_idx" ON "Produccion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CajaSesion_codigo_key" ON "CajaSesion"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "CajaSesion_abiertaLock_key" ON "CajaSesion"("abiertaLock");

-- CreateIndex
CREATE INDEX "CajaSesion_estado_idx" ON "CajaSesion"("estado");

-- CreateIndex
CREATE INDEX "CajaSesion_abiertaAt_idx" ON "CajaSesion"("abiertaAt");

-- CreateIndex
CREATE INDEX "MovimientoCaja_sesionId_idx" ON "MovimientoCaja"("sesionId");

-- CreateIndex
CREATE INDEX "MovimientoCaja_tipo_idx" ON "MovimientoCaja"("tipo");

-- CreateIndex
CREATE INDEX "MovimientoCaja_orderId_idx" ON "MovimientoCaja"("orderId");

-- CreateIndex
CREATE INDEX "MovimientoCaja_createdAt_idx" ON "MovimientoCaja"("createdAt");

-- CreateIndex
CREATE INDEX "ProductExtra_insumoId_idx" ON "ProductExtra"("insumoId");

-- CreateIndex
CREATE INDEX "MovimientoInsumo_produccionId_idx" ON "MovimientoInsumo"("produccionId");

-- CreateIndex
CREATE INDEX "Order_canal_idx" ON "Order"("canal");

-- CreateIndex
CREATE INDEX "Order_cajaSesionId_idx" ON "Order"("cajaSesionId");

-- AddForeignKey
ALTER TABLE "ProductExtra" ADD CONSTRAINT "ProductExtra_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produccion" ADD CONSTRAINT "Produccion_insumoElaboradoId_fkey" FOREIGN KEY ("insumoElaboradoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CajaSesion" ADD CONSTRAINT "CajaSesion_abiertaPorId_fkey" FOREIGN KEY ("abiertaPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CajaSesion" ADD CONSTRAINT "CajaSesion_cerradaPorId_fkey" FOREIGN KEY ("cerradaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "CajaSesion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cajaSesionId_fkey" FOREIGN KEY ("cajaSesionId") REFERENCES "CajaSesion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

