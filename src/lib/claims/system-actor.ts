import { prisma } from "@/lib/prisma";

export async function systemActor() {
  return (
    (await prisma.adjuster.findFirst({
      where: { isActive: true, role: "ADMIN" },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.adjuster.findFirst({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }))
  );
}
