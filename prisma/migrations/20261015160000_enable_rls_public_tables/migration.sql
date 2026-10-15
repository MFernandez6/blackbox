-- Every app reaches this database through Prisma as the table owner, never through the
-- Supabase Data API, so anon/authenticated get no access and no policies are needed.

ALTER TABLE "Adjuster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Claim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimEmail" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimNumberSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimPerson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClaimTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Claimant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  "Adjuster",
  "Claim",
  "ClaimAuditEvent",
  "ClaimContact",
  "ClaimEmail",
  "ClaimNote",
  "ClaimNumberSequence",
  "ClaimPerson",
  "ClaimPolicy",
  "ClaimSummaryReport",
  "ClaimTask",
  "Claimant",
  "Document",
  "DocumentVaultEntry",
  "Inspection",
  "InspectionItem",
  "InspectionSession",
  "Payment",
  "Person",
  "Photo",
  "Property",
  "ReferenceExample",
  "StatusHistory",
  "_prisma_migrations"
FROM anon, authenticated;

-- Tables added by later migrations start private instead of inheriting Supabase's default grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
