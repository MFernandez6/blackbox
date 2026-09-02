import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { blackgateServiceAuthorized } from "@/lib/integrations/service-auth";
import { systemActor } from "@/lib/claims/system-actor";
import {
  findClaimByIntakeId,
  openClaimFromIntake,
} from "@/lib/claims/open-from-intake";
import {
  fnolIntakeSchema,
  lossTypeEnum,
  preferredContactEnum,
} from "@/lib/schemas/claim";

export const dynamic = "force-dynamic";

const inboundSchema = z.object({
  claimants: z
    .array(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        mailingAddress: z.string().optional().nullable(),
        preferredContactMethod: preferredContactEnum.optional(),
        isPrimaryContact: z.boolean().optional(),
      })
    )
    .min(1),
  property: z.object({
    propertyAddress: z.string().optional().nullable(),
    zipCode: z.string().optional().nullable(),
    county: z.string().optional().nullable(),
    lossType: lossTypeEnum.optional(),
    dateOfLoss: z.string().optional().nullable(),
    lossDescription: z.string().optional().nullable(),
    isCatClaim: z.boolean().optional(),
  }),
  policy: z
    .object({
      policyNumber: z.string().optional().nullable(),
      carrierName: z.string().optional().nullable(),
      insurerClaimNumber: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  source: z.object({
    product: z.literal("BLACKGATE"),
    intakeNumber: z.string().min(1),
    intakeId: z.string().min(1),
  }),
});

function normalizeZip(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "00000";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * BLACKGATE promote — opens a BLACKBOX claim from an accepted intake.
 * Idempotent on source.intakeId.
 */
export async function POST(req: NextRequest) {
  if (!blackgateServiceAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedInbound = inboundSchema.safeParse(await req.json().catch(() => null));
  if (!parsedInbound.success) {
    return NextResponse.json(
      { error: parsedInbound.error.errors[0]?.message ?? "Invalid intake payload." },
      { status: 400 }
    );
  }

  const raw = parsedInbound.data;
  const existing = await findClaimByIntakeId(raw.source.intakeId);
  if (existing) {
    return NextResponse.json({
      id: existing.id,
      claimNumber: existing.claimNumber,
      reused: true,
    });
  }

  const propertyAddress =
    raw.property.propertyAddress?.trim() || "See BLACKGATE intake";
  const coerced = {
    claimants: raw.claimants.map((c, index) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email?.trim() || "intake@blacklineadjusting.com",
      phone: c.phone?.trim() || "0000000000",
      mailingAddress: c.mailingAddress?.trim() || propertyAddress,
      preferredContactMethod: c.preferredContactMethod ?? "EMAIL",
      isPrimaryContact:
        c.isPrimaryContact ??
        (raw.claimants.filter((x) => x.isPrimaryContact).length === 0 &&
          index === 0),
    })),
    property: {
      propertyAddress,
      zipCode: normalizeZip(raw.property.zipCode),
      county: raw.property.county?.trim() || "Unknown",
      lossType: raw.property.lossType ?? "OTHER",
      dateOfLoss: raw.property.dateOfLoss || todayIso(),
      lossDescription:
        raw.property.lossDescription?.trim() || "See BLACKGATE intake file.",
      isCatClaim: raw.property.isCatClaim ?? false,
    },
    policy: {
      policyNumber: raw.policy?.policyNumber ?? null,
      carrierName: raw.policy?.carrierName ?? null,
      insurerClaimNumber: raw.policy?.insurerClaimNumber ?? null,
    },
  };

  const parsed = fnolIntakeSchema.safeParse(coerced);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Intake failed validation." },
      { status: 400 }
    );
  }

  const actor = await systemActor();
  if (!actor) {
    return NextResponse.json(
      { error: "No active adjuster to own the promoted file." },
      { status: 500 }
    );
  }

  try {
    const claim = await openClaimFromIntake({
      parsed: parsed.data,
      actorId: actor.id,
      source: raw.source,
    });
    revalidatePath("/dashboard");
    revalidatePath(`/claims/${claim.id}`);
    return NextResponse.json({
      id: claim.id,
      claimNumber: claim.claimNumber,
    });
  } catch (error) {
    console.error("BLACKGATE intake:", error);
    return NextResponse.json(
      { error: "Unable to open claim from BLACKGATE." },
      { status: 500 }
    );
  }
}
