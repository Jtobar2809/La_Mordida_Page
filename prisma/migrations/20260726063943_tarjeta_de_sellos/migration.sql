-- CreateEnum
CREATE TYPE "StampQRStatus" AS ENUM ('PENDIENTE', 'RECLAMADO', 'EXPIRADO');

-- CreateTable
CREATE TABLE "StampCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStamps" INTEGER NOT NULL DEFAULT 0,
    "cardsCompleted" INTEGER NOT NULL DEFAULT 0,
    "rewardReady" BOOLEAN NOT NULL DEFAULT false,
    "rewardClaimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StampCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StampQR" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "StampQRStatus" NOT NULL DEFAULT 'PENDIENTE',
    "generatedById" TEXT NOT NULL,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "stampCardId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampQR_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StampCard_userId_key" ON "StampCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StampQR_token_key" ON "StampQR"("token");

-- CreateIndex
CREATE INDEX "StampQR_token_idx" ON "StampQR"("token");

-- CreateIndex
CREATE INDEX "StampQR_status_idx" ON "StampQR"("status");

-- CreateIndex
CREATE INDEX "StampQR_expiresAt_idx" ON "StampQR"("expiresAt");

-- AddForeignKey
ALTER TABLE "StampCard" ADD CONSTRAINT "StampCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampQR" ADD CONSTRAINT "StampQR_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampQR" ADD CONSTRAINT "StampQR_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampQR" ADD CONSTRAINT "StampQR_stampCardId_fkey" FOREIGN KEY ("stampCardId") REFERENCES "StampCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
