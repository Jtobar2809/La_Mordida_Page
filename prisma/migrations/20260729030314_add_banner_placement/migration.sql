-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('HERO', 'PROMOCIONES');

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "placement" "BannerPlacement" NOT NULL DEFAULT 'PROMOCIONES';

-- CreateIndex
CREATE INDEX "Banner_placement_idx" ON "Banner"("placement");
