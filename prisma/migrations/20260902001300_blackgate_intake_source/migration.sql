-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "sourceProduct" TEXT,
ADD COLUMN     "sourceIntakeId" TEXT,
ADD COLUMN     "sourceIntakeNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Claim_sourceIntakeId_key" ON "Claim"("sourceIntakeId");
