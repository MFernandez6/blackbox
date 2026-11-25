import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Writes the shared staff password and the copies Gate, Letter, and Ledger keep.
 * Bumps sessionVersion so outstanding sessions and reset links stop working.
 */
export async function saveAdjusterPassword(
  adjuster: { id: string; email: string },
  newPassword: string,
  opts: { mustChangePassword: boolean }
) {
  const passwordHash = await hash(newPassword, 12);
  const email = adjuster.email.toLowerCase();
  await prisma.adjuster.update({
    where: { id: adjuster.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: opts.mustChangePassword,
      failedLoginCount: 0,
      lockedUntil: null,
      sessionVersion: { increment: 1 },
    },
  });
  await prisma.$executeRaw`
    UPDATE blackgate."Staff"
    SET "passwordHash" = ${passwordHash}, "updatedAt" = now()
    WHERE lower(email) = ${email}
  `;
  await prisma.$executeRaw`
    UPDATE blackletter."Staff"
    SET "passwordHash" = ${passwordHash}, "updatedAt" = now()
    WHERE lower(email) = ${email}
  `;
  await prisma.$executeRaw`
    UPDATE public.ledger_staff
    SET "passwordHash" = ${passwordHash}, "updatedAt" = now()
    WHERE lower(email) = ${email}
  `;
}
