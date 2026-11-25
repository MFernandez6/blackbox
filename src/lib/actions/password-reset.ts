"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/actions/claims";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";
import { recordAuthEvent, requestMeta } from "@/lib/security/login-guard";
import { passwordProblems } from "@/lib/security/password-policy";
import { createPasswordResetToken, readPasswordResetToken } from "@/lib/security/password-reset-token";
import { saveAdjusterPassword } from "@/lib/security/save-password";

const emailSchema = z.string().trim().toLowerCase().email();
const HOUR_MS = 60 * 60 * 1000;
const SENT = "If that email belongs to an active staff account, a reset link is on its way. It expires in 30 minutes.";

function appOrigin() {
  const configured = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return "https://box.blacklinepublicadjusters.com";
}

async function tooManyRequests(email: string, ip: string | null) {
  const since = new Date(Date.now() - HOUR_MS);
  const [byEmail, byIp] = await Promise.all([
    prisma.authEvent.count({
      where: { email, event: "PASSWORD_RESET_REQUEST", createdAt: { gte: since } },
    }),
    ip
      ? prisma.authEvent.count({
          where: { ip, event: "PASSWORD_RESET_REQUEST", createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);
  return byEmail >= 5 || byIp >= 10;
}

export async function requestPasswordResetAction(emailRaw: string): Promise<ActionResult<{ message: string }>> {
  const parsed = emailSchema.safeParse(emailRaw);
  if (!parsed.success) return { ok: false, error: "Enter a valid email." };
  const email = parsed.data;
  const meta = requestMeta({ headers: headers() });

  try {
    if (await tooManyRequests(email, meta.ip)) {
      return { ok: false, error: "Too many reset requests. Wait an hour and try again." };
    }

    const adjuster = await prisma.adjuster.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true, sessionVersion: true },
    });
    await recordAuthEvent({
      email,
      adjusterId: adjuster?.id,
      event: "PASSWORD_RESET_REQUEST",
      detail: adjuster?.isActive ? null : "unknown",
      ...meta,
    });

    if (adjuster?.isActive) {
      const token = createPasswordResetToken(adjuster.email, adjuster.sessionVersion);
      const link = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
      const delivery = await sendPasswordResetEmail(adjuster.email, link);
      if (delivery === "unconfigured") {
        return { ok: false, error: "Password reset email is not configured yet." };
      }
      if (delivery === "failed") {
        return { ok: false, error: "The reset email could not be sent. Try again in a few minutes." };
      }
    }

    return { ok: true, data: { message: SENT } };
  } catch (e) {
    console.error("[password-reset] request failed", e);
    return { ok: false, error: "Unable to start a password reset." };
  }
}

export async function resetPasswordAction(input: {
  token: string;
  newPassword: string;
}): Promise<ActionResult> {
  const token = readPasswordResetToken(input.token ?? "");
  if (!token) return { ok: false, error: "This reset link is invalid or has expired." };

  try {
    const adjuster = await prisma.adjuster.findUnique({ where: { email: token.email } });
    if (!adjuster || !adjuster.isActive || adjuster.sessionVersion !== token.sv) {
      return { ok: false, error: "This reset link is invalid or has expired." };
    }
    const problems = passwordProblems(input.newPassword, { email: adjuster.email, name: adjuster.name });
    if (problems.length) return { ok: false, error: `Password needs: ${problems.join(", ")}.` };

    await saveAdjusterPassword(adjuster, input.newPassword, { mustChangePassword: false });
    await recordAuthEvent({
      email: adjuster.email,
      adjusterId: adjuster.id,
      event: "PASSWORD_RESET",
      detail: "self-service",
    });
    return { ok: true, data: undefined };
  } catch (e) {
    console.error("[password-reset] reset failed", e);
    return { ok: false, error: "Unable to reset the password." };
  }
}
