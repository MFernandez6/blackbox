import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serviceKeyAuthorized } from "@/lib/integrations/service-auth";
import {
  loadSummaryReportPayload,
  saveSummaryReport,
  summaryReportInputSchema,
} from "@/lib/reports/summary-report-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return serviceKeyAuthorized(req, [process.env.BLACKLETTER_API_KEY?.trim()]);
}

function claimRef(params: { claimId?: string | null; claimNumber?: string | null }) {
  if (params.claimId) return { id: params.claimId };
  if (params.claimNumber) return { claimNumber: params.claimNumber };
  return null;
}

/** BLACKLETTER reads the report (live claim data + saved edits) to view, edit, and print. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ref = claimRef({
    claimId: req.nextUrl.searchParams.get("claimId"),
    claimNumber: req.nextUrl.searchParams.get("claimNumber"),
  });
  if (!ref) {
    return NextResponse.json({ error: "claimId or claimNumber is required." }, { status: 400 });
  }
  const payload = await loadSummaryReportPayload(ref);
  if (!payload) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }
  return NextResponse.json(publicPayload(payload));
}

function publicPayload(
  payload: NonNullable<Awaited<ReturnType<typeof loadSummaryReportPayload>>>
) {
  return { claim: payload.claim, auto: payload.auto, saved: payload.saved };
}

const putSchema = summaryReportInputSchema.extend({
  claimId: z.string().optional(),
  claimNumber: z.string().optional(),
  actorEmail: z.string().email().optional(),
});

export async function PUT(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid report payload." },
      { status: 400 }
    );
  }
  const ref = claimRef(parsed.data);
  if (!ref) {
    return NextResponse.json({ error: "claimId or claimNumber is required." }, { status: 400 });
  }
  const claim = await prisma.claim.findUnique({
    where: ref,
    select: { id: true, isArchived: true },
  });
  if (!claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  if (claim.isArchived) {
    return NextResponse.json({ error: "Archived files are sealed." }, { status: 400 });
  }

  const actor =
    (parsed.data.actorEmail
      ? await prisma.adjuster.findFirst({
          where: {
            email: { equals: parsed.data.actorEmail, mode: "insensitive" },
            isActive: true,
            role: { in: ["ADMIN", "ADJUSTER"] },
          },
          select: { id: true },
        })
      : null) ??
    (await prisma.adjuster.findFirst({
      where: { isActive: true, role: "ADMIN" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }));
  if (!actor) {
    return NextResponse.json({ error: "No active adjuster to record the edit." }, { status: 500 });
  }

  const { header, sections, status } = parsed.data;
  await saveSummaryReport({
    claimId: claim.id,
    actorId: actor.id,
    via: "BLACKLETTER",
    input: { header, sections, status },
  });
  revalidatePath(`/claims/${claim.id}`);
  revalidatePath(`/claims/${claim.id}/summary-report`);

  const payload = await loadSummaryReportPayload({ id: claim.id });
  return NextResponse.json(publicPayload(payload!));
}
