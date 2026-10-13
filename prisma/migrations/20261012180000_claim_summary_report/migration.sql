-- CreateTable
CREATE TABLE "ClaimSummaryReport" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "header" JSONB,
    "sections" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "updatedVia" TEXT NOT NULL DEFAULT 'BLACKBOX',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimSummaryReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClaimSummaryReport_claimId_key" ON "ClaimSummaryReport"("claimId");

-- CreateIndex
CREATE INDEX "ClaimSummaryReport_updatedAt_idx" ON "ClaimSummaryReport"("updatedAt");

-- CreateIndex
CREATE INDEX "ClaimSummaryReport_createdById_idx" ON "ClaimSummaryReport"("createdById");

-- CreateIndex
CREATE INDEX "ClaimSummaryReport_updatedById_idx" ON "ClaimSummaryReport"("updatedById");

-- AddForeignKey
ALTER TABLE "ClaimSummaryReport" ADD CONSTRAINT "ClaimSummaryReport_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimSummaryReport" ADD CONSTRAINT "ClaimSummaryReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimSummaryReport" ADD CONSTRAINT "ClaimSummaryReport_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma connects as the table owner; RLS with no policies keeps the Supabase Data API out.
ALTER TABLE "ClaimSummaryReport" ENABLE ROW LEVEL SECURITY;
