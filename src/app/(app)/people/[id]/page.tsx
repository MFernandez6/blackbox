import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canEdit, getSession } from "@/lib/auth";
import {
  PersonProfileClient,
  type PersonFileLink,
} from "@/components/people/person-profile-client";
import type { PersonDetail } from "@/components/people/types";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const person = await prisma.person.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      claims: {
        orderBy: { createdAt: "desc" },
        include: {
          claim: {
            select: {
              id: true,
              claimNumber: true,
              propertyAddress: true,
              status: true,
              isArchived: true,
              assignedAdjusterId: true,
            },
          },
        },
      },
    },
  });
  if (!person) notFound();

  const visible = person.claims.filter(
    (l) => session.user.role !== "ADJUSTER" || l.claim.assignedAdjusterId === session.user.id
  );

  const detail: PersonDetail = {
    id: person.id,
    name: person.name,
    title: person.title,
    company: person.company,
    role: person.role,
    mobilePhone: person.mobilePhone,
    officePhone: person.officePhone,
    email: person.email,
    website: person.website,
    address: person.address,
    languages: person.languages,
    preferredContactMethod: person.preferredContactMethod,
    bestTimeToReach: person.bestTimeToReach,
    temperament: person.temperament,
    notes: person.notes,
    hasCard: Boolean(person.cardImageUrl),
    createdByName: person.createdBy.name,
    updatedByName: person.updatedBy?.name ?? null,
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
  };

  const files: PersonFileLink[] = visible.map((l) => ({
    linkId: l.id,
    claimId: l.claim.id,
    claimNumber: l.claim.claimNumber,
    propertyAddress: l.claim.propertyAddress,
    status: l.claim.status,
    isArchived: l.claim.isArchived,
    roleOnFile: l.roleOnFile,
  }));

  return (
    <PersonProfileClient
      person={detail}
      files={files}
      hiddenFileCount={person.claims.length - visible.length}
      canEdit={canEdit(session.user.role)}
      canDelete={session.user.role === "ADMIN"}
    />
  );
}
