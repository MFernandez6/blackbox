import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  ClaimDetailClient,
  type ClaimDetailData,
} from "@/components/claims/claim-detail-client";
import { ClaimDetailSkeleton } from "@/components/claims/claim-detail-skeleton";
import type { CarrierExpertInput } from "@/lib/schemas/claim";
import { parseLimitsJson } from "@/lib/policy-extraction";

export const dynamic = "force-dynamic";

function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

async function ClaimDetailDataLoader({
  id,
  tab,
}: {
  id: string;
  tab?: string;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      claimants: { orderBy: { isPrimaryContact: "desc" } },
      statusHistory: {
        orderBy: { changedAt: "desc" },
        include: { changedBy: { select: { name: true } } },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
          vaultEntry: { select: { displayPath: true } },
        },
      },
      payments: {
        orderBy: { date: "desc" },
        include: { recordedBy: { select: { name: true } } },
      },
      contacts: { orderBy: { createdAt: "desc" } },
      tasks: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        include: {
          assignedTo: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      emails: {
        orderBy: { emailDate: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
      policies: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 40,
        include: { actor: { select: { name: true } } },
      },
    },
  });

  if (!claim) notFound();

  if (
    session.user.role === "ADJUSTER" &&
    claim.assignedAdjusterId !== session.user.id
  ) {
    redirect("/dashboard");
  }

  const adjusters = await prisma.adjuster.findMany({
    where: { isActive: true, role: { in: ["ADMIN", "ADJUSTER"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const data: ClaimDetailData = {
    id: claim.id,
    claimNumber: claim.claimNumber,
    insurerClaimNumber: claim.insurerClaimNumber,
    status: claim.status,
    lossType: claim.lossType,
    dateOfLoss: claim.dateOfLoss.toISOString(),
    propertyAddress: claim.propertyAddress,
    zipCode: claim.zipCode,
    county: claim.county,
    lossDescription: claim.lossDescription,
    policyNumber: claim.policyNumber,
    carrierName: claim.carrierName,
    deskExaminerName: claim.deskExaminerName,
    deskExaminerPhone: claim.deskExaminerPhone,
    deskExaminerEmail: claim.deskExaminerEmail,
    fieldAdjusterName: claim.fieldAdjusterName,
    fieldAdjusterPhone: claim.fieldAdjusterPhone,
    fieldAdjusterEmail: claim.fieldAdjusterEmail,
    experts: Array.isArray(claim.experts)
      ? (claim.experts as CarrierExpertInput[])
      : [],
    coverageALimit: claim.coverageALimit?.toString() ?? null,
    coverageBLimit: claim.coverageBLimit?.toString() ?? null,
    coverageCLimit: claim.coverageCLimit?.toString() ?? null,
    coverageDLimit: claim.coverageDLimit?.toString() ?? null,
    policyExclusions: claim.policyExclusions,
    policyEndorsements: claim.policyEndorsements,
    coverageAnalysis: claim.coverageAnalysis,
    policyParsedAt: isoDate(claim.policyParsedAt),
    policies: claim.policies.map((p) => ({
      id: p.id,
      line: p.line,
      label: p.label,
      policyNumber: p.policyNumber,
      carrierName: p.carrierName,
      namedInsured: p.namedInsured,
      effectiveDate: isoDate(p.effectiveDate),
      expirationDate: isoDate(p.expirationDate),
      limits: parseLimitsJson(p.limits),
      deductibleNotes: p.deductibleNotes,
      exclusions: p.exclusions,
      endorsements: p.endorsements,
      analysis: p.analysis,
      premium: p.premium?.toString() ?? null,
      documentId: p.documentId,
      parsedAt: isoDate(p.parsedAt),
      isPrimary: p.isPrimary,
    })),
    estimatedValue: claim.estimatedValue?.toString() ?? null,
    demandAmount: claim.demandAmount?.toString() ?? null,
    demandSentDate: isoDate(claim.demandSentDate),
    rcvAmount: claim.rcvAmount?.toString() ?? null,
    acvAmount: claim.acvAmount?.toString() ?? null,
    settlementAmount: claim.settlementAmount?.toString() ?? null,
    settlementDate: isoDate(claim.settlementDate),
    settlementNotes: claim.settlementNotes,
    isCatClaim: claim.isCatClaim,
    contingencyFeePercent: claim.contingencyFeePercent.toString(),
    assignedAdjusterId: claim.assignedAdjusterId,
    initialContactDate: isoDate(claim.initialContactDate),
    scheduledAppointmentDate: isoDate(claim.scheduledAppointmentDate),
    lossInspectedDate: isoDate(claim.lossInspectedDate),
    estimateCreatedDate: isoDate(claim.estimateCreatedDate),
    reportCreatedDate: isoDate(claim.reportCreatedDate),
    estimateSentDate: isoDate(claim.estimateSentDate),
    isArchived: claim.isArchived,
    createdAt: claim.createdAt.toISOString(),
    claimants: claim.claimants.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      mailingAddress: c.mailingAddress,
      preferredContactMethod: c.preferredContactMethod,
      isPrimaryContact: c.isPrimaryContact,
    })),
    statusHistory: claim.statusHistory.map((h) => ({
      id: h.id,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      changedAt: h.changedAt.toISOString(),
      note: h.note,
      changedByName: h.changedBy.name,
    })),
    documents: claim.documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      mimeType: d.mimeType,
      docType: d.docType,
      uploadedAt: d.uploadedAt.toISOString(),
      uploaderName: d.uploadedBy.name,
      extractionStatus: d.extractionStatus,
      policyLine: d.policyLine,
      isCertifiedPolicy: d.isCertifiedPolicy,
      displayPath: d.vaultEntry?.displayPath ?? null,
      source:
        d.extractedData &&
        typeof d.extractedData === "object" &&
        !Array.isArray(d.extractedData) &&
        (d.extractedData as { source?: string }).source === "BLACKLETTER"
          ? "BLACKLETTER"
          : null,
    })),
    auditEvents: claim.auditEvents.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      summary: e.summary,
      createdAt: e.createdAt.toISOString(),
      actorName: e.actor.name,
    })),
    payments: claim.payments.map((p) => ({
      id: p.id,
      type: p.type,
      amount: p.amount.toString(),
      date: p.date.toISOString(),
      note: p.note,
      recordedByName: p.recordedBy.name,
    })),
    contacts: claim.contacts.map((c) => ({
      id: c.id,
      kind: c.kind,
      name: c.name,
      company: c.company,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
    })),
    tasks: claim.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      dueDate: isoDate(t.dueDate),
      assignedToId: t.assignedToId,
      assignedToName: t.assignedTo?.name ?? null,
      createdByName: t.createdBy.name,
      createdAt: t.createdAt.toISOString(),
    })),
    notes: claim.notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdByName: n.createdBy.name,
      createdAt: n.createdAt.toISOString(),
    })),
    emails: claim.emails.map((e) => ({
      id: e.id,
      direction: e.direction,
      subject: e.subject,
      fromAddress: e.fromAddress,
      toAddress: e.toAddress,
      ccAddress: e.ccAddress,
      body: e.body,
      emailDate: e.emailDate.toISOString(),
      createdByName: e.createdBy.name,
    })),
  };

  return (
    <ClaimDetailClient
      claim={data}
      adjusters={adjusters}
      role={session.user.role}
      initialTab={tab}
    />
  );
}

export default function ClaimDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  return (
    <Suspense fallback={<ClaimDetailSkeleton />}>
      <ClaimDetailDataLoader id={params.id} tab={searchParams.tab} />
    </Suspense>
  );
}
