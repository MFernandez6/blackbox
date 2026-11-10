-- Account security (shared Adjuster table)
ALTER TABLE "Adjuster" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "mfaEnabledAt" TIMESTAMP(3),
ADD COLUMN     "mfaSecret" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "phone" TEXT;

-- Fla. Stat. § 626.854 fee cap and contract lifecycle inputs
ALTER TABLE "Claim" ADD COLUMN     "claimReportedDate" DATE,
ADD COLUMN     "contractCancelledDate" DATE,
ADD COLUMN     "contractExecutedDate" DATE,
ADD COLUMN     "contractSentToInsurerDate" DATE,
ADD COLUMN     "emergencyDeclarationId" TEXT,
ADD COLUMN     "isReopenedClaim" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priorInsurerPayments" DECIMAL(14,2);

CREATE TABLE "EmergencyDeclaration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "executiveOrder" TEXT,
    "declaredDate" DATE NOT NULL,
    "counties" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyDeclaration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthEvent" (
    "id" TEXT NOT NULL,
    "adjusterId" TEXT,
    "email" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "app" TEXT NOT NULL DEFAULT 'BLACKBOX',
    "ip" TEXT,
    "userAgent" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmergencyDeclaration_declaredDate_idx" ON "EmergencyDeclaration"("declaredDate");
CREATE INDEX "AuthEvent_email_createdAt_idx" ON "AuthEvent"("email", "createdAt");
CREATE INDEX "AuthEvent_ip_createdAt_idx" ON "AuthEvent"("ip", "createdAt");
CREATE INDEX "AuthEvent_adjusterId_idx" ON "AuthEvent"("adjusterId");
CREATE INDEX "Claim_emergencyDeclarationId_idx" ON "Claim"("emergencyDeclarationId");

ALTER TABLE "Claim" ADD CONSTRAINT "Claim_emergencyDeclarationId_fkey" FOREIGN KEY ("emergencyDeclarationId") REFERENCES "EmergencyDeclaration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Same posture as every other public table: RLS on, no anon/authenticated access
ALTER TABLE "EmergencyDeclaration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "EmergencyDeclaration" FROM anon, authenticated;
REVOKE ALL ON TABLE "AuthEvent" FROM anon, authenticated;
