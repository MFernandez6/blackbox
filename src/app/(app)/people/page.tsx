import type { PersonRole, Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canEdit, getSession } from "@/lib/auth";
import { PERSON_ROLES } from "@/lib/people/labels";
import {
  PeopleDirectoryClient,
  type PeopleRow,
} from "@/components/people/people-directory-client";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: { q?: string; role?: string; lang?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const where: Prisma.PersonWhereInput = {};
  const q = searchParams.q?.trim();
  if (q) {
    const or: Prisma.PersonWhereInput[] = [
      { name: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
    const digits = q.replace(/\D/g, "");
    if (digits.length >= 4) {
      or.push(
        { mobilePhone: { contains: digits.slice(-4) } },
        { officePhone: { contains: digits.slice(-4) } }
      );
    }
    where.OR = or;
  }
  if (searchParams.role && PERSON_ROLES.includes(searchParams.role as PersonRole)) {
    where.role = searchParams.role as PersonRole;
  }
  if (searchParams.lang) where.languages = { has: searchParams.lang };

  const [people, total] = await Promise.all([
    prisma.person.findMany({
      where,
      orderBy: { name: "asc" },
      take: 200,
      include: { _count: { select: { claims: true } } },
    }),
    prisma.person.count(),
  ]);

  const rows: PeopleRow[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    title: p.title,
    company: p.company,
    role: p.role,
    mobilePhone: p.mobilePhone,
    officePhone: p.officePhone,
    email: p.email,
    languages: p.languages,
    temperament: p.temperament,
    fileCount: p._count.claims,
  }));

  return (
    <PeopleDirectoryClient
      people={rows}
      total={total}
      canAdd={canEdit(session.user.role)}
    />
  );
}
