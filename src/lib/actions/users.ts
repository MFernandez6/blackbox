"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { generateTemporaryPassword } from "@/lib/security/temporary-password";
import { recordAuthEvent } from "@/lib/security/login-guard";
import type { ActionResult } from "@/lib/actions/claims";

const roleEnum = z.enum(["ADMIN", "ADJUSTER", "VIEWER"]);

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().toLowerCase().email("Valid email required"),
  licenseNumber: z.string().trim().max(40).default(""),
  title: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(30).default(""),
  role: roleEnum,
});

const updateSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  licenseNumber: z.string().trim().max(40).default(""),
  title: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(30).default(""),
  role: roleEnum,
  isActive: z.boolean(),
});

async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return session;
}

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  if (e instanceof Error && e.message === "FORBIDDEN") {
    return { ok: false, error: "Only an admin can manage users." };
  }
  console.error(e);
  return { ok: false, error: fallback };
}

export async function createUserAction(raw: unknown): Promise<ActionResult<{ temporaryPassword: string }>> {
  try {
    const session = await requireAdmin();
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed." };
    const d = parsed.data;
    if (await prisma.adjuster.findUnique({ where: { email: d.email } })) {
      return { ok: false, error: "A user with that email already exists." };
    }
    const temporaryPassword = generateTemporaryPassword();
    const user = await prisma.adjuster.create({
      data: {
        name: d.name,
        email: d.email,
        licenseNumber: d.licenseNumber,
        title: d.title || null,
        phone: d.phone || null,
        role: d.role,
        passwordHash: await hash(temporaryPassword, 12),
        mustChangePassword: true,
      },
    });
    await recordAuthEvent({
      email: d.email,
      adjusterId: user.id,
      event: "USER_CREATED",
      detail: `by ${session.user.email} as ${d.role}`,
    });
    revalidatePath("/admin/users");
    return { ok: true, data: { temporaryPassword } };
  } catch (e) {
    return fail(e, "Unable to create user.");
  }
}

export async function updateUserAction(id: string, raw: unknown): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Validation failed." };
    const d = parsed.data;
    const user = await prisma.adjuster.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "User not found." };
    if (id === session.user.id && (!d.isActive || d.role !== "ADMIN")) {
      return { ok: false, error: "You cannot deactivate or demote your own account." };
    }
    const revoke = user.isActive !== d.isActive || user.role !== d.role;
    await prisma.adjuster.update({
      where: { id },
      data: {
        name: d.name,
        licenseNumber: d.licenseNumber,
        title: d.title || null,
        phone: d.phone || null,
        role: d.role,
        isActive: d.isActive,
        ...(revoke ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    await recordAuthEvent({
      email: user.email,
      adjusterId: id,
      event: "USER_UPDATED",
      detail: `by ${session.user.email}: role ${d.role}, ${d.isActive ? "active" : "deactivated"}`,
    });
    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e, "Unable to update user.");
  }
}

export async function resetUserPasswordAction(id: string): Promise<ActionResult<{ temporaryPassword: string }>> {
  try {
    const session = await requireAdmin();
    const user = await prisma.adjuster.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "User not found." };
    const temporaryPassword = generateTemporaryPassword();
    await prisma.adjuster.update({
      where: { id },
      data: {
        passwordHash: await hash(temporaryPassword, 12),
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    await recordAuthEvent({ email: user.email, adjusterId: id, event: "PASSWORD_RESET", detail: `by ${session.user.email}` });
    revalidatePath("/admin/users");
    return { ok: true, data: { temporaryPassword } };
  } catch (e) {
    return fail(e, "Unable to reset password.");
  }
}

export async function unlockUserAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const user = await prisma.adjuster.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
    await recordAuthEvent({ email: user.email, adjusterId: id, event: "USER_UPDATED", detail: `unlocked by ${session.user.email}` });
    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e, "Unable to unlock user.");
  }
}

export async function resetUserMfaAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const user = await prisma.adjuster.update({
      where: { id },
      data: { mfaSecret: null, mfaEnabledAt: null, sessionVersion: { increment: 1 } },
    });
    await recordAuthEvent({ email: user.email, adjusterId: id, event: "MFA_DISABLED", detail: `reset by ${session.user.email}` });
    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e, "Unable to reset MFA.");
  }
}

/** Sign a user out everywhere without changing anything else. */
export async function revokeUserSessionsAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const user = await prisma.adjuster.update({
      where: { id },
      data: { sessionVersion: { increment: 1 } },
    });
    await recordAuthEvent({ email: user.email, adjusterId: id, event: "USER_UPDATED", detail: `sessions revoked by ${session.user.email}` });
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e, "Unable to revoke sessions.");
  }
}
