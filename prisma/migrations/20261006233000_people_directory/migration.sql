-- CreateEnum
CREATE TYPE "PersonRole" AS ENUM ('PROPERTY_MANAGER', 'ASSOCIATION_BOARD', 'PUBLIC_ADJUSTER', 'CARRIER_ADJUSTER', 'INDEPENDENT_ADJUSTER', 'CONTRACTOR', 'MITIGATION', 'ENGINEER', 'ATTORNEY', 'APPRAISER', 'UMPIRE', 'INSURANCE_AGENT', 'VENDOR', 'OTHER');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "role" "PersonRole" NOT NULL DEFAULT 'OTHER',
    "mobilePhone" TEXT,
    "officePhone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredContactMethod" "PreferredContactMethod",
    "bestTimeToReach" TEXT,
    "temperament" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "cardImageUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimPerson" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "roleOnFile" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_name_idx" ON "Person"("name");

-- CreateIndex
CREATE INDEX "Person_company_idx" ON "Person"("company");

-- CreateIndex
CREATE INDEX "Person_role_idx" ON "Person"("role");

-- CreateIndex
CREATE INDEX "Person_email_idx" ON "Person"("email");

-- CreateIndex
CREATE INDEX "ClaimPerson_personId_idx" ON "ClaimPerson"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimPerson_claimId_personId_key" ON "ClaimPerson"("claimId", "personId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimPerson" ADD CONSTRAINT "ClaimPerson_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimPerson" ADD CONSTRAINT "ClaimPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimPerson" ADD CONSTRAINT "ClaimPerson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Adjuster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

