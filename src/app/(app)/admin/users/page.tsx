import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { UsersAdmin } from "@/components/admin/users-admin";

export const dynamic = "force-dynamic";

export default async function UsersAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.adjuster.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      licenseNumber: true,
      title: true,
      phone: true,
      isActive: true,
      lockedUntil: true,
      mfaEnabledAt: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  });
  const now = new Date();

  return (
    <UsersAdmin
      currentUserId={session.user.id}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        licenseNumber: u.licenseNumber,
        title: u.title ?? "",
        phone: u.phone ?? "",
        isActive: u.isActive,
        isLocked: !!u.lockedUntil && u.lockedUntil > now,
        mfaEnabled: !!u.mfaEnabledAt,
        mustChangePassword: u.mustChangePassword,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      }))}
    />
  );
}
