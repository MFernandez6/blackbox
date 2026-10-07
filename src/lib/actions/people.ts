"use server";

import { revalidatePath } from "next/cache";
import type { PersonRole, Prisma } from "@prisma/client";
import { canEdit, requireSession } from "@/lib/auth";
import { assertCanEditClaim } from "@/lib/claims/access";
import { logClaimAudit } from "@/lib/claims/audit";
import { prisma } from "@/lib/prisma";
import { deleteStoredDocument } from "@/lib/storage";
import {
  claimPersonLinkSchema,
  personCreateSchema,
  personInputSchema,
} from "@/lib/schemas/people";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type PersonSearchResult = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  role: PersonRole;
  mobilePhone: string | null;
  officePhone: string | null;
  email: string | null;
};

export type PossibleDuplicate = { id: string; name: string; company: string | null };

const searchSelect = {
  id: true,
  name: true,
  title: true,
  company: true,
  role: true,
  mobilePhone: true,
  officePhone: true,
  email: true,
} satisfies Prisma.PersonSelect;

function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

function revalidatePeople(personId?: string) {
  revalidatePath("/people");
  if (personId) revalidatePath(`/people/${personId}`);
}

export async function searchPeopleAction(
  query: string
): Promise<ActionResult<PersonSearchResult[]>> {
  try {
    await requireSession();
    const q = query.trim();
    if (q.length < 2) return { ok: true, data: [] };

    const digits = digitsOnly(q);
    const or: Prisma.PersonWhereInput[] = [
      { name: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    if (digits.length >= 4) {
      or.push(
        { mobilePhone: { contains: digits.slice(-4) } },
        { officePhone: { contains: digits.slice(-4) } }
      );
    }

    const rows = await prisma.person.findMany({
      where: { OR: or },
      select: searchSelect,
      orderBy: { name: "asc" },
      take: 8,
    });
    return { ok: true, data: rows };
  } catch {
    return { ok: false, error: "Unable to search the directory." };
  }
}

async function findPossibleDuplicates(input: {
  name: string;
  email: string | null;
  mobilePhone: string | null;
  officePhone: string | null;
}): Promise<PossibleDuplicate[]> {
  const or: Prisma.PersonWhereInput[] = [
    { name: { equals: input.name, mode: "insensitive" } },
  ];
  if (input.email) or.push({ email: { equals: input.email, mode: "insensitive" } });

  const candidates = await prisma.person.findMany({
    where: { OR: or },
    select: { id: true, name: true, company: true },
    take: 5,
  });

  const phones = [input.mobilePhone, input.officePhone]
    .map(digitsOnly)
    .filter((d) => d.length >= 10);
  if (phones.length) {
    const byPhone = await prisma.person.findMany({
      where: {
        OR: phones.flatMap((d) => [
          { mobilePhone: { contains: d.slice(-4) } },
          { officePhone: { contains: d.slice(-4) } },
        ]),
      },
      select: { id: true, name: true, company: true, mobilePhone: true, officePhone: true },
      take: 20,
    });
    for (const p of byPhone) {
      const theirs = [p.mobilePhone, p.officePhone].map(digitsOnly);
      if (phones.some((d) => theirs.includes(d)) && !candidates.some((c) => c.id === p.id)) {
        candidates.push({ id: p.id, name: p.name, company: p.company });
      }
    }
  }
  return candidates;
}

export async function createPersonAction(
  raw: unknown
): Promise<
  | { ok: true; data: { id: string } }
  | { ok: false; error: string; duplicates?: PossibleDuplicate[] }
> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges." };
    }
    const parsed = personCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed." };
    }
    const { claimId, roleOnFile, allowDuplicate, ...person } = parsed.data;

    if (claimId) {
      const gate = await assertCanEditClaim(claimId);
      if (gate.error) return { ok: false, error: gate.error };
    }

    if (!allowDuplicate) {
      const duplicates = await findPossibleDuplicates(person);
      if (duplicates.length) {
        return {
          ok: false,
          error: "This person may already be in the directory.",
          duplicates,
        };
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.person.create({
        data: { ...person, createdById: session.user.id },
      });
      if (claimId) {
        await tx.claimPerson.create({
          data: {
            claimId,
            personId: row.id,
            roleOnFile,
            createdById: session.user.id,
          },
        });
      }
      return row;
    });

    if (claimId) {
      await logClaimAudit({
        claimId,
        actorId: session.user.id,
        action: "PERSON_LINK",
        entityType: "Person",
        entityId: created.id,
        summary: `Added ${created.name} to the file`,
      });
      revalidatePath(`/claims/${claimId}`);
    }
    revalidatePeople(created.id);
    return { ok: true, data: { id: created.id } };
  } catch {
    return { ok: false, error: "Unable to save this person." };
  }
}

export async function updatePersonAction(
  personId: string,
  raw: unknown
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!canEdit(session.user.role)) {
      return { ok: false, error: "Insufficient privileges." };
    }
    const parsed = personInputSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed." };
    }

    const updated = await prisma.person.update({
      where: { id: personId },
      data: { ...parsed.data, updatedById: session.user.id },
      select: { claims: { select: { claimId: true } } },
    });

    for (const link of updated.claims) revalidatePath(`/claims/${link.claimId}`);
    revalidatePeople(personId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to update this person." };
  }
}

export async function deletePersonAction(personId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (session.user.role !== "ADMIN") {
      return { ok: false, error: "Only admins can delete people from the directory." };
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { name: true, cardImageUrl: true, claims: { select: { claimId: true } } },
    });
    if (!person) return { ok: false, error: "Person not found." };

    await prisma.$transaction([
      prisma.claimPerson.deleteMany({ where: { personId } }),
      prisma.person.delete({ where: { id: personId } }),
    ]);
    if (person.cardImageUrl) await deleteStoredDocument(person.cardImageUrl);

    for (const link of person.claims) {
      await logClaimAudit({
        claimId: link.claimId,
        actorId: session.user.id,
        action: "PERSON_UNLINK",
        entityType: "Person",
        entityId: personId,
        summary: `${person.name} was deleted from the People directory`,
      });
      revalidatePath(`/claims/${link.claimId}`);
    }
    revalidatePeople();
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to delete this person." };
  }
}

export async function linkPersonToClaimAction(raw: unknown): Promise<ActionResult> {
  try {
    const parsed = claimPersonLinkSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed." };
    }
    const { claimId, personId, roleOnFile } = parsed.data;
    const gate = await assertCanEditClaim(claimId);
    if (gate.error || !gate.session) return { ok: false, error: gate.error ?? "Unauthorized." };

    const existing = await prisma.claimPerson.findUnique({
      where: { claimId_personId: { claimId, personId } },
      select: { id: true },
    });
    if (existing) return { ok: false, error: "Already on this file." };

    const link = await prisma.claimPerson.create({
      data: { claimId, personId, roleOnFile, createdById: gate.session.user.id },
      include: { person: { select: { name: true } } },
    });

    await logClaimAudit({
      claimId,
      actorId: gate.session.user.id,
      action: "PERSON_LINK",
      entityType: "Person",
      entityId: personId,
      summary: `Added ${link.person.name} to the file`,
    });
    revalidatePath(`/claims/${claimId}`);
    revalidatePeople(personId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to add this person to the file." };
  }
}

export async function unlinkPersonFromClaimAction(linkId: string): Promise<ActionResult> {
  try {
    const link = await prisma.claimPerson.findUnique({
      where: { id: linkId },
      include: { person: { select: { name: true } } },
    });
    if (!link) return { ok: false, error: "Link not found." };

    const gate = await assertCanEditClaim(link.claimId);
    if (gate.error || !gate.session) return { ok: false, error: gate.error ?? "Unauthorized." };

    await prisma.claimPerson.delete({ where: { id: linkId } });
    await logClaimAudit({
      claimId: link.claimId,
      actorId: gate.session.user.id,
      action: "PERSON_UNLINK",
      entityType: "Person",
      entityId: link.personId,
      summary: `Removed ${link.person.name} from the file`,
    });
    revalidatePath(`/claims/${link.claimId}`);
    revalidatePeople(link.personId);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Unable to remove this person from the file." };
  }
}
