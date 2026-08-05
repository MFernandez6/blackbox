import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  ClaimDetailClient,
  type ClaimDetailData,
} from "@/components/claims/claim-detail-client";
import { ClaimDetailSkeleton } from "@/components/claims/claim-detail-skeleton";

export const dynamic = "force-dynamic";

async function ClaimDetailData({ id }: { id: string }) {
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
        include: { uploadedBy: { select: { name: true } } },
      },
      payments: {
        orderBy: { date: "desc" },
        include: { recordedBy: { select: { name: true } } },
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
      ? (claim.experts as ClaimDetailData["experts"])
      : [],
    coverageALimit: claim.coverageALimit?.toString() ?? null,
    coverageBLimit: claim.coverageBLimit?.toString() ?? null,
    coverageCLimit: claim.coverageCLimit?.toString() ?? null,
    coverageDLimit: claim.coverageDLimit?.toString() ?? null,
    policyExclusions: claim.policyExclusions,
    policyEndorsements: claim.policyEndorsements,
    coverageAnalysis: claim.coverageAnalysis,
    policyParsedAt: claim.policyParsedAt?.toISOString() ?? null,
    estimatedValue: claim.estimatedValue?.toString() ?? null,
    isCatClaim: claim.isCatClaim,
    contingencyFeePercent: claim.contingencyFeePercent.toString(),
    assignedAdjusterId: claim.assignedAdjusterId,
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
      docType: d.docType,
      uploadedAt: d.uploadedAt.toISOString(),
      uploaderName: d.uploadedBy.name,
      extractionStatus: d.extractionStatus,
    })),
    payments: claim.payments.map((p) => ({
      id: p.id,
      type: p.type,
      amount: p.amount.toString(),
      date: p.date.toISOString(),
      note: p.note,
      recordedByName: p.recordedBy.name,
    })),
  };

  return (
    <ClaimDetailClient
      claim={data}
      adjusters={adjusters}
      role={session.user.role}
    />
  );
}

export default function ClaimDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense fallback={<ClaimDetailSkeleton />}>
      <ClaimDetailData id={params.id} />
    </Suspense>
  );
}
