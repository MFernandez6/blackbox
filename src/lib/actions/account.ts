"use server";

import { compare, hash } from "bcryptjs";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { passwordProblems } from "@/lib/security/password-policy";
import { recordAuthEvent } from "@/lib/security/login-guard";
import {
  generateTotpSecret,
  openMfaSecret,
  otpauthUri,
  sealMfaSecret,
  verifyTotp,
} from "@/lib/security/totp";
import type { ActionResult } from "@/lib/actions/claims";

async function currentAdjuster() {
  const session = await requireSession();
  const adjuster = await prisma.adjuster.findUnique({ where: { id: session.user.id } });
  if (!adjuster || !adjuster.isActive) throw new Error("UNAUTHORIZED");
  return adjuster;
}

/** Changing the password signs out every session, including this one. */
export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  try {
    const adjuster = await currentAdjuster();
    if (!(await compare(input.currentPassword, adjuster.passwordHash))) {
      return { ok: false, error: "Current password is incorrect." };
    }
    const problems = passwordProblems(input.newPassword, { email: adjuster.email, name: adjuster.name });
    if (problems.length) return { ok: false, error: `Password needs: ${problems.join(", ")}.` };
    if (await compare(input.newPassword, adjuster.passwordHash)) {
      return { ok: false, error: "Choose a password you have not used here before." };
    }

    await prisma.adjuster.update({
      where: { id: adjuster.id },
      data: {
        passwordHash: await hash(input.newPassword, 12),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    await recordAuthEvent({ email: adjuster.email, adjusterId: adjuster.id, event: "PASSWORD_CHANGED" });
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to change password." };
  }
}

export async function beginMfaEnrollmentAction(): Promise<
  ActionResult<{ qrDataUrl: string; secret: string }>
> {
  try {
    const adjuster = await currentAdjuster();
    if (adjuster.mfaEnabledAt) return { ok: false, error: "MFA is already enabled." };
    const secret = generateTotpSecret();
    await prisma.adjuster.update({
      where: { id: adjuster.id },
      data: { mfaSecret: sealMfaSecret(secret), mfaEnabledAt: null },
    });
    const uri = otpauthUri({ secret, account: adjuster.email, issuer: "BLACKSUITE" });
    const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return { ok: true, data: { qrDataUrl, secret } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to start MFA setup." };
  }
}

export async function confirmMfaEnrollmentAction(code: string): Promise<ActionResult> {
  try {
    const adjuster = await currentAdjuster();
    if (adjuster.mfaEnabledAt) return { ok: false, error: "MFA is already enabled." };
    if (!adjuster.mfaSecret) return { ok: false, error: "Start MFA setup first." };
    if (!verifyTotp(openMfaSecret(adjuster.mfaSecret), code)) {
      return { ok: false, error: "That code did not match. Check the time on your phone and retry." };
    }
    await prisma.adjuster.update({
      where: { id: adjuster.id },
      data: { mfaEnabledAt: new Date() },
    });
    await recordAuthEvent({ email: adjuster.email, adjusterId: adjuster.id, event: "MFA_ENABLED" });
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to enable MFA." };
  }
}

export async function disableMfaAction(input: { password: string; code: string }): Promise<ActionResult> {
  try {
    const adjuster = await currentAdjuster();
    if (!adjuster.mfaEnabledAt || !adjuster.mfaSecret) return { ok: false, error: "MFA is not enabled." };
    if (process.env.REQUIRE_ADMIN_MFA === "1" && adjuster.role === "ADMIN") {
      return { ok: false, error: "MFA is required for admin accounts." };
    }
    if (!(await compare(input.password, adjuster.passwordHash))) {
      return { ok: false, error: "Password is incorrect." };
    }
    if (!verifyTotp(openMfaSecret(adjuster.mfaSecret), input.code)) {
      return { ok: false, error: "Authenticator code is incorrect." };
    }
    await prisma.adjuster.update({
      where: { id: adjuster.id },
      data: { mfaSecret: null, mfaEnabledAt: null, sessionVersion: { increment: 1 } },
    });
    await recordAuthEvent({ email: adjuster.email, adjusterId: adjuster.id, event: "MFA_DISABLED" });
    return { ok: true, data: undefined };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Unable to disable MFA." };
  }
}
