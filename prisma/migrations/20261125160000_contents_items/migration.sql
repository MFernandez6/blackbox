-- Coverage C contents inventory. Additive only.

CREATE TABLE "ContentsItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemName" TEXT NOT NULL,
    "brand" TEXT,
    "modelNumber" TEXT,
    "description" TEXT,
    "condition" TEXT,
    "matchKind" TEXT NOT NULL,
    "productTitle" TEXT,
    "productUrl" TEXT,
    "listedPrice" DECIMAL(12,2),
    "priceNote" TEXT,
    "confirmedUnitCost" DECIMAL(12,2),
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "documentId" TEXT,
    "sourceApp" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentsItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentsItem_documentId_key" ON "ContentsItem"("documentId");
CREATE INDEX "ContentsItem_claimId_idx" ON "ContentsItem"("claimId");
CREATE INDEX "ContentsItem_createdById_idx" ON "ContentsItem"("createdById");

ALTER TABLE "ContentsItem" ADD CONSTRAINT "ContentsItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentsItem" ADD CONSTRAINT "ContentsItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentsItem" ADD CONSTRAINT "ContentsItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContentsItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ContentsItem" FROM anon, authenticated;
