import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { DocumentsVaultClient } from "@/components/claims/documents-vault-client";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const claim = await prisma.claim.findUnique({
    where: { id: params.id },
    include: {
      documents: {
        orderBy: { uploadedAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
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

  return (
    <DocumentsVaultClient
      claimId={claim.id}
      claimNumber={claim.claimNumber}
      role={session.user.role}
      documents={claim.documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        mimeType: d.mimeType,
        docType: d.docType,
        uploadedAt: d.uploadedAt.toISOString(),
        uploaderName: d.uploadedBy.name,
      }))}
    />
  );
}
