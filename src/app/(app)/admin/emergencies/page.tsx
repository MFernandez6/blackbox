import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { EmergenciesAdmin } from "@/components/admin/emergencies-admin";

export const dynamic = "force-dynamic";

export default async function EmergenciesAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const rows = await prisma.emergencyDeclaration.findMany({
    orderBy: { declaredDate: "desc" },
    include: { _count: { select: { claims: true } } },
  });

  return (
    <EmergenciesAdmin
      declarations={rows.map((r) => ({
        id: r.id,
        name: r.name,
        executiveOrder: r.executiveOrder,
        declaredDate: r.declaredDate.toISOString().slice(0, 10),
        counties: r.counties,
        notes: r.notes,
        isActive: r.isActive,
        claimCount: r._count.claims,
      }))}
    />
  );
}
