/**
 * BLACKBOX seed — sample Adjusters + Claims for local/dev review.
 *
 * Run (once Prisma Client is generated and DATABASE_URL is set):
 *   npx prisma db seed
 *
 * Or directly:
 *   npx tsx prisma/seed.ts
 *
 * Default passwords for all seeded adjusters: Password123!
 * (bcrypt cost 10 — change immediately in any shared environment)
 */

import { PrismaClient, ClaimStatus, LossType, PreferredContactMethod, DocType, PaymentType, AdjusterRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Password123!";

type SeedClaimInput = {
  year: number;
  sequence: number;
  status: ClaimStatus;
  lossType: LossType;
  dateOfLoss: Date;
  propertyAddress: string;
  zipCode: string;
  county: string;
  lossDescription: string;
  policyNumber?: string | null;
  carrierName?: string | null;
  insurerClaimNumber?: string | null;
  deskExaminerName?: string | null;
  deskExaminerPhone?: string | null;
  deskExaminerEmail?: string | null;
  fieldAdjusterName?: string | null;
  fieldAdjusterPhone?: string | null;
  fieldAdjusterEmail?: string | null;
  experts?: Array<{
    name: string;
    firm?: string | null;
    specialty?: string | null;
    phone?: string | null;
    email?: string | null;
  }>;
  coverageALimit?: string | null;
  coverageBLimit?: string | null;
  coverageCLimit?: string | null;
  coverageDLimit?: string | null;
  policyExclusions?: string | null;
  policyEndorsements?: string | null;
  coverageAnalysis?: string | null;
  estimatedValue?: string | null;
  isCatClaim?: boolean;
  /** Defaults: 20% standard, 10% when isCatClaim */
  contingencyFeePercent?: string;
  assignedAdjusterEmail?: string | null;
  isArchived?: boolean;
  claimants: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    mailingAddress: string;
    preferredContactMethod: PreferredContactMethod;
    isPrimaryContact: boolean;
  }>;
  /** Chronological status transitions after initial INTAKE (excluding create). */
  statusTrail?: Array<{
    previousStatus: ClaimStatus;
    newStatus: ClaimStatus;
    note: string;
    changedByEmail: string;
    daysAgo: number;
  }>;
  documents?: Array<{
    fileName: string;
    fileUrl: string;
    fileSizeBytes: number;
    mimeType: string;
    docType: DocType;
    uploadedByEmail: string;
  }>;
  payments?: Array<{
    type: PaymentType;
    amount: string;
    date: Date;
    note?: string;
    recordedByEmail: string;
  }>;
};

function claimNumber(year: number, sequence: number): string {
  return `BB-${year}-${String(sequence).padStart(4, "0")}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function main() {
  console.log("BLACKBOX seed — clearing existing records…");

  // Order respects onDelete: Restrict
  await prisma.payment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.claimant.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.claimNumberSequence.deleteMany();
  await prisma.adjuster.deleteMany();

  const passwordHash = await hash(SEED_PASSWORD, 10);

  console.log("Creating adjusters…");

  // Owner / principal adjuster — Blackline Public Adjusters LLC
  const miguel = await prisma.adjuster.create({
    data: {
      name: "Miguel Fernandez",
      email: "miguel.fernandez@blacklineadjusting.com",
      passwordHash,
      licenseNumber: "W100001",
      role: AdjusterRole.ADMIN,
    },
  });

  const diana = await prisma.adjuster.create({
    data: {
      name: "Diana Reyes",
      email: "diana.reyes@blacklineadjusting.com",
      passwordHash,
      licenseNumber: "W123456",
      role: AdjusterRole.ADMIN,
    },
  });

  const marcus = await prisma.adjuster.create({
    data: {
      name: "Marcus Chen",
      email: "marcus.chen@blacklineadjusting.com",
      passwordHash,
      licenseNumber: "W234567",
      role: AdjusterRole.ADJUSTER,
    },
  });

  const sofia = await prisma.adjuster.create({
    data: {
      name: "Sofia Alvarez",
      email: "sofia.alvarez@blacklineadjusting.com",
      passwordHash,
      licenseNumber: "W345678",
      role: AdjusterRole.VIEWER,
    },
  });

  const frankie = await prisma.adjuster.create({
    data: {
      name: "Frankie",
      email: "frankie@blacklineadjusting.com",
      passwordHash,
      licenseNumber: "W456789",
      role: AdjusterRole.ADJUSTER,
    },
  });

  const adjusterByEmail: Record<string, string> = {
    [miguel.email]: miguel.id,
    [diana.email]: diana.id,
    [marcus.email]: marcus.id,
    [sofia.email]: sofia.id,
    [frankie.email]: frankie.id,
  };

  const year = new Date().getFullYear();

  const claims: SeedClaimInput[] = [
    {
      year,
      sequence: 1,
      status: ClaimStatus.INTAKE,
      lossType: LossType.WATER,
      dateOfLoss: daysAgo(12),
      propertyAddress: "1847 Coral Way, Miami, FL",
      zipCode: "33145",
      county: "Miami-Dade",
      lossDescription:
        "Supply line failure under kitchen sink; cascading damage to cabinets, flooring, and adjacent drywall. Carrier not yet notified.",
      policyNumber: null,
      carrierName: null,
      estimatedValue: "45000.00",
      assignedAdjusterEmail: miguel.email,
      claimants: [
        {
          firstName: "Elena",
          lastName: "Vasquez",
          email: "elena.vasquez@email.com",
          phone: "305-555-0142",
          mailingAddress: "1847 Coral Way, Miami, FL 33145",
          preferredContactMethod: PreferredContactMethod.EMAIL,
          isPrimaryContact: true,
        },
      ],
    },
    {
      year,
      sequence: 2,
      status: ClaimStatus.UNDER_REVIEW,
      lossType: LossType.WIND,
      dateOfLoss: daysAgo(45),
      propertyAddress: "902 Ocean Blvd, Fort Lauderdale, FL",
      zipCode: "33316",
      county: "Broward",
      lossDescription:
        "Hurricane-force winds removed sections of roof covering; secondary water intrusion throughout second floor.",
      policyNumber: "HO-FL-8821944",
      carrierName: "Citizens Property Insurance",
      insurerClaimNumber: "CIT-2026-884211",
      deskExaminerName: "Renee Caldwell",
      deskExaminerPhone: "850-555-2201",
      deskExaminerEmail: "r.caldwell@citizensfla.com",
      fieldAdjusterName: "Tom Bradley",
      fieldAdjusterPhone: "954-555-4410",
      fieldAdjusterEmail: "t.bradley@ia-florida.com",
      experts: [
        {
          name: "Dr. Alan Pierce",
          firm: "Gulf Coast Engineering",
          specialty: "Roof / wind uplift",
          phone: "813-555-0900",
          email: "apierce@gce-eng.com",
        },
      ],
      coverageALimit: "420000.00",
      coverageBLimit: "42000.00",
      coverageCLimit: "210000.00",
      coverageDLimit: "84000.00",
      policyExclusions:
        "Flood; earth movement; ordinance or law (limited); wear and tear; intentional loss.",
      policyEndorsements:
        "HO 04 94 — Limited Fungi; HO 04 16 — Premises Alarm; Roof Surfacing Payment Schedule.",
      coverageAnalysis:
        "Wind peril appears within Coverage A. Secondary water likely follows as ensuing loss if wind created the opening. Confirm Roof Surfacing endorsement for ACV vs RCV on covering.",
      estimatedValue: "185000.00",
      isCatClaim: true,
      contingencyFeePercent: "10.00",
      assignedAdjusterEmail: marcus.email,
      claimants: [
        {
          firstName: "James",
          lastName: "Whitaker",
          email: "j.whitaker@email.com",
          phone: "954-555-0198",
          mailingAddress: "902 Ocean Blvd, Fort Lauderdale, FL 33316",
          preferredContactMethod: PreferredContactMethod.PHONE,
          isPrimaryContact: true,
        },
        {
          firstName: "Patricia",
          lastName: "Whitaker",
          email: "p.whitaker@email.com",
          phone: "954-555-0199",
          mailingAddress: "902 Ocean Blvd, Fort Lauderdale, FL 33316",
          preferredContactMethod: PreferredContactMethod.TEXT,
          isPrimaryContact: false,
        },
      ],
      statusTrail: [
        {
          previousStatus: ClaimStatus.INTAKE,
          newStatus: ClaimStatus.UNDER_REVIEW,
          note: "File triaged. Policy declarations requested from insured.",
          changedByEmail: diana.email,
          daysAgo: 38,
        },
      ],
      documents: [
        {
          fileName: "whitaker-declarations.pdf",
          fileUrl: "/seed/docs/whitaker-declarations.pdf",
          fileSizeBytes: 248320,
          mimeType: "application/pdf",
          docType: DocType.POLICY,
          uploadedByEmail: marcus.email,
        },
      ],
    },
    {
      year,
      sequence: 3,
      status: ClaimStatus.INVESTIGATION,
      lossType: LossType.HAIL,
      dateOfLoss: daysAgo(60),
      propertyAddress: "4412 Palm Harbor Dr, Tampa, FL",
      zipCode: "33615",
      county: "Hillsborough",
      lossDescription:
        "Confirmed hail event; granule loss and soft-metal denting on HVAC condenser. Engineering inspection scheduled.",
      policyNumber: "POL-99102-HA",
      carrierName: "State Farm",
      insurerClaimNumber: "SF-FL-4419283",
      deskExaminerName: "Kevin Ortiz",
      deskExaminerPhone: "800-555-7788",
      deskExaminerEmail: "kevin.ortiz@statefarm.com",
      fieldAdjusterName: "Lisa Nguyen",
      fieldAdjusterPhone: "813-555-3302",
      experts: [
        {
          name: "Midwest Hail Labs",
          firm: "MHL Forensics",
          specialty: "Hail metallurgy",
        },
      ],
      estimatedValue: "72000.00",
      assignedAdjusterEmail: diana.email,
      claimants: [
        {
          firstName: "Robert",
          lastName: "Nguyen",
          email: "robert.nguyen@email.com",
          phone: "813-555-0166",
          mailingAddress: "4412 Palm Harbor Dr, Tampa, FL 33615",
          preferredContactMethod: PreferredContactMethod.EMAIL,
          isPrimaryContact: true,
        },
      ],
      statusTrail: [
        {
          previousStatus: ClaimStatus.INTAKE,
          newStatus: ClaimStatus.UNDER_REVIEW,
          note: "Intake complete. Assigned for desk review.",
          changedByEmail: diana.email,
          daysAgo: 55,
        },
        {
          previousStatus: ClaimStatus.UNDER_REVIEW,
          newStatus: ClaimStatus.INVESTIGATION,
          note: "Carrier dispute on causation. Engineering retained.",
          changedByEmail: diana.email,
          daysAgo: 40,
        },
      ],
      documents: [
        {
          fileName: "roof-elevation-north.jpg",
          fileUrl: "/seed/docs/roof-elevation-north.jpg",
          fileSizeBytes: 1_842_112,
          mimeType: "image/jpeg",
          docType: DocType.PHOTO,
          uploadedByEmail: diana.email,
        },
        {
          fileName: "preliminary-estimate.pdf",
          fileUrl: "/seed/docs/preliminary-estimate.pdf",
          fileSizeBytes: 512000,
          mimeType: "application/pdf",
          docType: DocType.ESTIMATE,
          uploadedByEmail: diana.email,
        },
      ],
    },
    {
      year,
      sequence: 4,
      status: ClaimStatus.NEGOTIATING,
      lossType: LossType.FIRE,
      dateOfLoss: daysAgo(120),
      propertyAddress: "215 Magnolia St, Orlando, FL",
      zipCode: "32801",
      county: "Orange",
      lossDescription:
        "Kitchen grease fire; smoke and heat damage throughout primary residence. Partial rebuild estimate under review with carrier.",
      policyNumber: "UFG-44021",
      carrierName: "Universal Property & Casualty",
      insurerClaimNumber: "UPC-9920144",
      deskExaminerName: "Sandra Blake",
      deskExaminerPhone: "407-555-8800",
      deskExaminerEmail: "sblake@universalproperty.com",
      fieldAdjusterName: "Darren Moss",
      fieldAdjusterPhone: "407-555-1199",
      fieldAdjusterEmail: "dmoss@coastal-ia.com",
      experts: [
        {
          name: "FireCause Analytics",
          firm: "FCA Inc.",
          specialty: "Origin & cause",
          phone: "305-555-6700",
        },
        {
          name: "Maria Santos, PE",
          firm: "Orlando Structural",
          specialty: "Structural engineer",
          email: "msantos@orlandostruct.com",
        },
      ],
      estimatedValue: "310000.00",
      assignedAdjusterEmail: marcus.email,
      claimants: [
        {
          firstName: "Aisha",
          lastName: "Coleman",
          email: "aisha.coleman@email.com",
          phone: "407-555-0110",
          mailingAddress: "215 Magnolia St, Orlando, FL 32801",
          preferredContactMethod: PreferredContactMethod.PHONE,
          isPrimaryContact: true,
        },
      ],
      statusTrail: [
        {
          previousStatus: ClaimStatus.INTAKE,
          newStatus: ClaimStatus.UNDER_REVIEW,
          note: "FNOL logged. Fire report obtained from OFR.",
          changedByEmail: marcus.email,
          daysAgo: 110,
        },
        {
          previousStatus: ClaimStatus.UNDER_REVIEW,
          newStatus: ClaimStatus.INVESTIGATION,
          note: "Scope walk completed. Demand package drafting.",
          changedByEmail: marcus.email,
          daysAgo: 90,
        },
        {
          previousStatus: ClaimStatus.INVESTIGATION,
          newStatus: ClaimStatus.FILED,
          note: "Demand package submitted to carrier.",
          changedByEmail: diana.email,
          daysAgo: 70,
        },
        {
          previousStatus: ClaimStatus.FILED,
          newStatus: ClaimStatus.NEGOTIATING,
          note: "Carrier counter at 62% of demand. Negotiation opened.",
          changedByEmail: diana.email,
          daysAgo: 25,
        },
      ],
      documents: [
        {
          fileName: "demand-letter-coleman.pdf",
          fileUrl: "/seed/docs/demand-letter-coleman.pdf",
          fileSizeBytes: 890112,
          mimeType: "application/pdf",
          docType: DocType.DEMAND_LETTER,
          uploadedByEmail: marcus.email,
        },
        {
          fileName: "carrier-correspondence-0312.pdf",
          fileUrl: "/seed/docs/carrier-correspondence-0312.pdf",
          fileSizeBytes: 120400,
          mimeType: "application/pdf",
          docType: DocType.CORRESPONDENCE,
          uploadedByEmail: marcus.email,
        },
      ],
      payments: [
        {
          type: PaymentType.ADVANCE,
          amount: "25000.00",
          date: daysAgo(50),
          note: "Carrier ALE advance — recorded for fee tracking.",
          recordedByEmail: diana.email,
        },
      ],
    },
    {
      year,
      sequence: 5,
      status: ClaimStatus.SETTLED,
      lossType: LossType.WIND,
      dateOfLoss: daysAgo(200),
      propertyAddress: "78 Seagate Ln, Naples, FL",
      zipCode: "34102",
      county: "Collier",
      lossDescription:
        "Tropical storm roof and screen enclosure damage. Settled after supplemental.",
      policyNumber: "FLA-77821-HO",
      carrierName: "Florida Peninsula",
      insurerClaimNumber: "FPIC-7782101",
      deskExaminerName: "Helen Cho",
      deskExaminerEmail: "hcho@floridapeninsula.com",
      fieldAdjusterName: "Greg Hale",
      fieldAdjusterPhone: "239-555-4040",
      estimatedValue: "98000.00",
      isCatClaim: true,
      contingencyFeePercent: "10.00",
      assignedAdjusterEmail: diana.email,
      claimants: [
        {
          firstName: "Thomas",
          lastName: "Brennan",
          email: "t.brennan@email.com",
          phone: "239-555-0177",
          mailingAddress: "78 Seagate Ln, Naples, FL 34102",
          preferredContactMethod: PreferredContactMethod.EMAIL,
          isPrimaryContact: true,
        },
      ],
      statusTrail: [
        {
          previousStatus: ClaimStatus.INTAKE,
          newStatus: ClaimStatus.UNDER_REVIEW,
          note: "File opened post-storm surge intake.",
          changedByEmail: diana.email,
          daysAgo: 190,
        },
        {
          previousStatus: ClaimStatus.UNDER_REVIEW,
          newStatus: ClaimStatus.FILED,
          note: "Estimate and photos filed with carrier.",
          changedByEmail: diana.email,
          daysAgo: 160,
        },
        {
          previousStatus: ClaimStatus.FILED,
          newStatus: ClaimStatus.NEGOTIATING,
          note: "Supplemental for underpaid roofing line items.",
          changedByEmail: diana.email,
          daysAgo: 100,
        },
        {
          previousStatus: ClaimStatus.NEGOTIATING,
          newStatus: ClaimStatus.SETTLED,
          note: "Settlement agreement executed. Fee invoice pending.",
          changedByEmail: diana.email,
          daysAgo: 30,
        },
      ],
      payments: [
        {
          type: PaymentType.SETTLEMENT,
          amount: "87500.00",
          date: daysAgo(28),
          note: "Gross settlement per agreement.",
          recordedByEmail: diana.email,
        },
        {
          type: PaymentType.FEE,
          amount: "8750.00",
          date: daysAgo(27),
          note: "Contingency fee at 10% (CAT claim).",
          recordedByEmail: diana.email,
        },
      ],
    },
    {
      year,
      sequence: 6,
      status: ClaimStatus.DENIED,
      lossType: LossType.VANDALISM,
      dateOfLoss: daysAgo(90),
      propertyAddress: "3301 Atlantic Ave, Daytona Beach, FL",
      zipCode: "32118",
      county: "Volusia",
      lossDescription:
        "Forced entry and interior vandalism. Carrier issued denial citing vacancy exclusion — under evaluation for challenge.",
      policyNumber: "VAC-22091",
      carrierName: "American Integrity",
      insurerClaimNumber: "AIIC-22091044",
      deskExaminerName: "Paul Richter",
      deskExaminerPhone: "800-555-1212",
      deskExaminerEmail: "prichter@aiicfl.com",
      fieldAdjusterName: "Nina Brooks",
      fieldAdjusterPhone: "386-555-7781",
      estimatedValue: "38000.00",
      assignedAdjusterEmail: marcus.email,
      claimants: [
        {
          firstName: "Carol",
          lastName: "Diaz",
          email: "carol.diaz@email.com",
          phone: "386-555-0133",
          mailingAddress: "PO Box 441, Daytona Beach, FL 32115",
          preferredContactMethod: PreferredContactMethod.TEXT,
          isPrimaryContact: true,
        },
      ],
      statusTrail: [
        {
          previousStatus: ClaimStatus.INTAKE,
          newStatus: ClaimStatus.UNDER_REVIEW,
          note: "Police report on file. Policy review initiated.",
          changedByEmail: marcus.email,
          daysAgo: 85,
        },
        {
          previousStatus: ClaimStatus.UNDER_REVIEW,
          newStatus: ClaimStatus.FILED,
          note: "Proof of loss submitted.",
          changedByEmail: marcus.email,
          daysAgo: 70,
        },
        {
          previousStatus: ClaimStatus.FILED,
          newStatus: ClaimStatus.DENIED,
          note: "Carrier denial — vacancy exclusion. Record sealed pending appeal decision.",
          changedByEmail: diana.email,
          daysAgo: 20,
        },
      ],
      documents: [
        {
          fileName: "denial-letter-diaz.pdf",
          fileUrl: "/seed/docs/denial-letter-diaz.pdf",
          fileSizeBytes: 95600,
          mimeType: "application/pdf",
          docType: DocType.CORRESPONDENCE,
          uploadedByEmail: marcus.email,
        },
      ],
    },
  ];

  console.log("Creating claim number sequence + claims…");

  await prisma.claimNumberSequence.create({
    data: { year, lastValue: claims.length },
  });

  for (const input of claims) {
    const assignedAdjusterId = input.assignedAdjusterEmail
      ? adjusterByEmail[input.assignedAdjusterEmail]
      : null;

    const createdById = assignedAdjusterId ?? miguel.id;
    const number = claimNumber(input.year, input.sequence);

    await prisma.$transaction(async (tx) => {
      const claim = await tx.claim.create({
        data: {
          claimNumber: number,
          status: input.status,
          lossType: input.lossType,
          dateOfLoss: input.dateOfLoss,
          propertyAddress: input.propertyAddress,
          zipCode: input.zipCode,
          county: input.county,
          lossDescription: input.lossDescription,
          policyNumber: input.policyNumber ?? null,
          carrierName: input.carrierName ?? null,
          insurerClaimNumber: input.insurerClaimNumber ?? null,
          deskExaminerName: input.deskExaminerName ?? null,
          deskExaminerPhone: input.deskExaminerPhone ?? null,
          deskExaminerEmail: input.deskExaminerEmail ?? null,
          fieldAdjusterName: input.fieldAdjusterName ?? null,
          fieldAdjusterPhone: input.fieldAdjusterPhone ?? null,
          fieldAdjusterEmail: input.fieldAdjusterEmail ?? null,
          experts: input.experts ?? undefined,
          coverageALimit: input.coverageALimit ?? null,
          coverageBLimit: input.coverageBLimit ?? null,
          coverageCLimit: input.coverageCLimit ?? null,
          coverageDLimit: input.coverageDLimit ?? null,
          policyExclusions: input.policyExclusions ?? null,
          policyEndorsements: input.policyEndorsements ?? null,
          coverageAnalysis: input.coverageAnalysis ?? null,
          estimatedValue: input.estimatedValue ?? null,
          isCatClaim: input.isCatClaim ?? false,
          contingencyFeePercent:
            input.contingencyFeePercent ??
            (input.isCatClaim ? "10.00" : "20.00"),
          assignedAdjusterId,
          isArchived: input.isArchived ?? false,
          claimants: {
            create: input.claimants,
          },
          // Initial StatusHistory — previousStatus null, newStatus INTAKE
          statusHistory: {
            create: {
              previousStatus: null,
              newStatus: ClaimStatus.INTAKE,
              changedById: createdById,
              changedAt: daysAgo(
                (input.statusTrail?.[0]?.daysAgo ?? 10) + 5
              ),
              note: "Record opened. File integrity: sealed at intake.",
            },
          },
        },
      });

      if (input.statusTrail?.length) {
        for (const step of input.statusTrail) {
          await tx.statusHistory.create({
            data: {
              claimId: claim.id,
              previousStatus: step.previousStatus,
              newStatus: step.newStatus,
              changedById: adjusterByEmail[step.changedByEmail],
              changedAt: daysAgo(step.daysAgo),
              note: step.note,
            },
          });
        }
      }

      if (input.documents?.length) {
        for (const doc of input.documents) {
          await tx.document.create({
            data: {
              claimId: claim.id,
              fileName: doc.fileName,
              fileUrl: doc.fileUrl,
              fileSizeBytes: doc.fileSizeBytes,
              mimeType: doc.mimeType,
              docType: doc.docType,
              uploadedById: adjusterByEmail[doc.uploadedByEmail],
              // AI_HOOK: extractionStatus / extractedData intentionally NOT_APPLICABLE / unset this phase
              extractionStatus: "NOT_APPLICABLE",
            },
          });
        }
      }

      if (input.payments?.length) {
        for (const pay of input.payments) {
          await tx.payment.create({
            data: {
              claimId: claim.id,
              type: pay.type,
              amount: pay.amount,
              date: pay.date,
              note: pay.note ?? null,
              recordedById: adjusterByEmail[pay.recordedByEmail],
            },
          });
        }
      }
    });

    console.log(`  ${number} — ${input.status} / ${input.lossType}`);
  }

  console.log("");
  console.log("Seed complete.");
  console.log("  Adjusters: 5 (owner ADMIN + samples)");
  console.log(`  Claims:    ${claims.length} (year ${year}, sequence 0001–000${claims.length})`);
  console.log(`  Login:     miguel.fernandez@blacklineadjusting.com / ${SEED_PASSWORD}`);
  console.log(`             diana.reyes@blacklineadjusting.com / ${SEED_PASSWORD}`);
  console.log(`             frankie@blacklineadjusting.com / ${SEED_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
