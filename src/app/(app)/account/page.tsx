import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminMfaRequired, getSession } from "@/lib/auth";
import { AccountSecurity } from "@/components/account/account-security";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { required?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [adjuster, events] = await Promise.all([
    prisma.adjuster.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        role: true,
        licenseNumber: true,
        mfaEnabledAt: true,
        passwordChangedAt: true,
        lastLoginAt: true,
        mustChangePassword: true,
      },
    }),
    prisma.authEvent.findMany({
      where: { adjusterId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, event: true, app: true, ip: true, createdAt: true },
    }),
  ]);
  if (!adjuster) redirect("/login");

  return (
    <AccountSecurity
      required={
        adjuster.mustChangePassword
          ? "password"
          : searchParams.required === "mfa" && !adjuster.mfaEnabledAt
            ? "mfa"
            : null
      }
      mfaMandatory={adminMfaRequired() && adjuster.role === "ADMIN"}
      user={{
        name: adjuster.name,
        email: adjuster.email,
        role: adjuster.role,
        licenseNumber: adjuster.licenseNumber,
        mfaEnabled: !!adjuster.mfaEnabledAt,
        passwordChangedAt: adjuster.passwordChangedAt?.toISOString() ?? null,
        lastLoginAt: adjuster.lastLoginAt?.toISOString() ?? null,
      }}
      events={events.map((e) => ({
        id: e.id,
        event: e.event,
        app: e.app,
        ip: e.ip,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
