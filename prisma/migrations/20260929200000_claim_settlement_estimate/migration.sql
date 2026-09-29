-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "settlementEstimate" JSONB,
ADD COLUMN     "settlementEstimateAt" TIMESTAMP(3);
