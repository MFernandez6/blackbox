import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logClaimAudit } from "@/lib/claims/audit";
import { LOSS_TYPE_LABELS, POLICY_LINE_LABELS } from "@/lib/claims/labels";
import { OCCUPANCY_OPTIONS } from "@/lib/claims/report-details";
import { parseLimitsJson } from "@/lib/policy-extraction";
import {
  SUMMARY_DATE_BLANK,
  SUMMARY_HEADER_KEYS,
  SUMMARY_TEXT_KEYS,
  emptyHeaderValues,
  emptyTextValues,
  type SummaryHeaderKey,
  type SummaryHeaderValues,
  type SummaryPolicyLine,
  type SummaryReportAuto,
  type SummaryReportPayload,
  type SummaryReportSaved,
  type SummaryReportStatus,
  type SummaryTextKey,
  type SummaryTextValues,
} from "@/lib/reports/summary-report";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** @db.Date columns arrive as UTC midnight; format in UTC so the day never shifts. */
function shortDate(value: Date | null | undefined): string {
  if (!value) return "";
  return `${value.getUTCMonth() + 1}/${value.getUTCDate()}/${value.getUTCFullYear()}`;
}

function longDate(value: Date | null | undefined): string {
  if (!value) return "";
  return `${MONTHS[value.getUTCMonth()]} ${value.getUTCDate()}, ${value.getUTCFullYear()}`;
}

function easternShortDate(value: Date): string {
  return value.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function money(value: Prisma.Decimal | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function withZip(address: string, zip: string): string {
  const a = address.trim();
  if (!zip || a.includes(zip)) return a;
  return `${a} ${zip}`.trim();
}

function carrierContact(name: string | null | undefined): string {
  const n = name?.trim();
  return n ? `is ${n}` : "has not yet been identified";
}

const PERIL_WORDING: Record<string, string> = {
  WIND: "Windstorm",
  HAIL: "Hail",
  FIRE: "Fire and smoke",
  WATER: "Water damage",
  VANDALISM: "Vandalism and malicious mischief",
  OTHER: "",
};

const summaryClaimInclude = {
  claimants: { orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }] },
  assignedAdjuster: { select: { name: true } },
  policies: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
  contacts: {
    where: { kind: "MITIGATION" },
    orderBy: { createdAt: "asc" },
    take: 1,
    select: { name: true, company: true },
  },
  documents: {
    where: { isCertifiedPolicy: true },
    orderBy: { uploadedAt: "desc" },
    take: 1,
    select: { uploadedAt: true },
  },
  summaryReport: { include: { updatedBy: { select: { name: true } } } },
} satisfies Prisma.ClaimInclude;

type SummaryClaim = Prisma.ClaimGetPayload<{ include: typeof summaryClaimInclude }>;

function policyLimitLines(limits: unknown): SummaryPolicyLine["limits"] {
  return parseLimitsJson(limits)
    .filter((l) => l.amount !== null)
    .map((l) => ({ label: l.label, amount: money(l.amount) }));
}

function buildAuto(claim: SummaryClaim): SummaryReportAuto {
  const header = emptyHeaderValues();
  const sections = emptyTextValues();

  const names = claim.claimants
    .map((c) => `${c.firstName} ${c.lastName}`.trim())
    .filter(Boolean);
  const insured = names.join(" & ");
  const primary = claim.claimants[0];
  const riskAddress = withZip(claim.propertyAddress, claim.zipCode);

  const hoPolicy =
    claim.policies.find((p) => p.line === "HOMEOWNERS" && p.isPrimary) ??
    claim.policies.find((p) => p.line === "HOMEOWNERS");
  const primaryPolicy = hoPolicy ?? claim.policies.find((p) => p.isPrimary) ?? claim.policies[0];
  const hoLimits = hoPolicy ? parseLimitsJson(hoPolicy.limits) : [];
  const hoLimit = (key: string) => hoLimits.find((l) => l.key === key)?.amount ?? null;

  header.reportDate = shortDate(claim.reportCreatedDate) || easternShortDate(new Date());
  header.claimNumber = claim.claimNumber;
  header.carrierClaimNumber = claim.insurerClaimNumber ?? "";
  header.insured = insured;
  header.fieldAdjuster = claim.assignedAdjuster?.name ?? "";
  header.dateOfLoss = shortDate(claim.dateOfLoss);
  header.dateInspected = shortDate(claim.lossInspectedDate);
  header.taskCompleted = shortDate(claim.reportCreatedDate);
  header.riskAddress = riskAddress;
  header.mailingAddress = primary?.mailingAddress?.trim() ?? "";
  header.carrier = claim.carrierName ?? primaryPolicy?.carrierName ?? "";
  header.policyNumber = claim.policyNumber ?? primaryPolicy?.policyNumber ?? "";
  header.policyType = primaryPolicy
    ? [POLICY_LINE_LABELS[primaryPolicy.line], primaryPolicy.label].filter(Boolean).join(" — ")
    : claim.coverageALimit
      ? POLICY_LINE_LABELS.HOMEOWNERS
      : "";
  header.effectiveDate = shortDate(primaryPolicy?.effectiveDate);
  header.coverageA = money(claim.coverageALimit ?? hoLimit("coverage_a"));
  header.coverageB = money(claim.coverageBLimit ?? hoLimit("coverage_b"));
  header.coverageC = money(claim.coverageCLimit ?? hoLimit("coverage_c"));
  header.coverageD = money(claim.coverageDLimit ?? hoLimit("coverage_d"));

  const seenPolicies = new Set<string>();
  const otherPolicies: SummaryPolicyLine[] = claim.policies
    .filter((p) => p.id !== hoPolicy?.id)
    .filter((p) => {
      const key = [p.line, p.policyNumber ?? "", p.label ?? ""].join("|").toLowerCase();
      if (seenPolicies.has(key)) return false;
      seenPolicies.add(key);
      return true;
    })
    .map((p) => ({
      title: p.label || POLICY_LINE_LABELS[p.line],
      detail: [
        p.label ? POLICY_LINE_LABELS[p.line] : "",
        p.carrierName ?? "",
        p.policyNumber ? `Policy ${p.policyNumber}` : "",
        p.effectiveDate ? `Eff. ${shortDate(p.effectiveDate)}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      limits: policyLimitLines(p.limits),
    }));

  const certifiedPolicy = claim.documents[0];
  const notes = [
    `Initial contact was made with the insured, ${insured || "the named insured"}, on ${
      shortDate(claim.initialContactDate) || SUMMARY_DATE_BLANK
    }.`,
    claim.lossInspectedDate
      ? `The inspection took place on ${shortDate(claim.lossInspectedDate)}.`
      : claim.scheduledAppointmentDate
        ? `The inspection is scheduled for ${shortDate(claim.scheduledAppointmentDate)}.`
        : `The inspection took place on ${SUMMARY_DATE_BLANK}.`,
    `The carrier's assigned field adjuster ${carrierContact(
      claim.fieldAdjusterName
    )}, and the desk adjuster (claims examiner) ${carrierContact(claim.deskExaminerName)}.`,
    policyRequestNote(claim, certifiedPolicy?.uploadedAt),
  ];
  sections.assignmentNotes = notes.join("\n");

  sections.riskOccupancy = riskOccupancyDraft(claim, riskAddress);

  const peril = LOSS_TYPE_LABELS[claim.lossType].toLowerCase();
  if (claim.lossInspectedDate) {
    const present = claim.inspectionAttendees?.trim() || "Insured";
    sections.inspection = `The risk was inspected on ${longDate(
      claim.lossInspectedDate
    )} with the Public Adjuster and ${present} present. The claim involves a reported ${peril} loss on ${longDate(
      claim.dateOfLoss
    )}.${claim.lossDescription ? ` ${claim.lossDescription.trim()}` : ""}`;
  }
  const perilWording = PERIL_WORDING[claim.lossType];
  if (perilWording) {
    sections.causeOfLossStatement = `${perilWording} reported on ${shortDate(claim.dateOfLoss)}.`;
  }
  sections.originOfLoss = claim.originOfLoss?.trim() ?? "";
  sections.priorLosses = claim.priorLosses?.trim() ?? "";

  if (claim.moldObserved === true) {
    sections.mold =
      "Visible microbial growth was observed during the inspection. Testing and the policy's mold/fungi sublimit should be reviewed before remediation.";
  } else if (claim.moldObserved === false) {
    sections.mold = "No visible mold was observed during the inspection.";
  }

  if (claim.contentsDamaged === true) {
    sections.contents = `The insured reported damage to personal property. A contents inventory listing each item's age, quantity, and replacement cost has been requested.${
      header.coverageC ? ` The Coverage C limit is ${header.coverageC.replace("$ ", "$")}.` : ""
    }`;
  } else if (claim.contentsDamaged === false) {
    sections.contents =
      "No personal property damage was presented for inspection or observed at the time of the site visit.";
  }

  sections.ems = emsDraft(claim);
  sections.ale = aleDraft(claim, header.coverageD);
  sections.subrogation = claim.subrogationNotes?.trim() ?? "";

  return { header, sections, otherPolicies };
}

function sentence(text: string): string {
  const t = text.trim();
  return !t || /[.!?]$/.test(t) ? t : `${t}.`;
}

function withArticle(phrase: string): string {
  if (/^(a|an|the)\s/i.test(phrase)) return phrase;
  return `${/^[aeiou]/i.test(phrase) && !/^(one|uni|eu)/i.test(phrase) ? "an" : "a"} ${phrase}`;
}

const STORY_WORDS = ["", "one", "two", "three", "four", "five"];

function policyRequestNote(claim: SummaryClaim, certifiedUploadedAt?: Date): string {
  const requested = shortDate(claim.certifiedPolicyRequestedDate) || SUMMARY_DATE_BLANK;
  const received =
    shortDate(claim.certifiedPolicyReceivedDate) ||
    (certifiedUploadedAt ? easternShortDate(certifiedUploadedAt) : "");
  return `A certified copy of the policy was requested from the carrier on ${requested}${
    received ? ` and received on ${received}` : ""
  }.`;
}

function riskOccupancyDraft(claim: SummaryClaim, riskAddress: string): string {
  const where = `located at ${riskAddress}${claim.county ? ` in ${claim.county} County` : ""}`;
  const storyWord = claim.stories ? `${STORY_WORDS[claim.stories] ?? claim.stories}-story` : "";
  const dwelling = claim.dwellingType?.trim() || (storyWord ? "residence" : "");
  const parts = [
    dwelling
      ? `The insured property is ${withArticle([storyWord, dwelling].filter(Boolean).join(", "))} ${where}.`
      : `The insured property is ${where}.`,
  ];
  if (claim.yearBuilt) parts.push(`The home was built in ${claim.yearBuilt}.`);
  const construction = claim.constructionType?.trim();
  const roof = claim.roofCovering?.trim();
  if (construction) parts.push(`The structure is ${construction}.`);
  if (roof) parts.push(`The roof is ${withArticle(roof)}.`);
  const occupancy = OCCUPANCY_OPTIONS.find((o) => o.value === claim.occupancy);
  if (occupancy) parts.push(`The home is ${occupancy.phrase}.`);
  return parts.join(" ");
}

const ENGAGED_WORDING: Record<string, string> = {
  INSURED: "was selected and contracted by the insured",
  PUBLIC_ADJUSTER: "was selected and contracted by the insured through the Public Adjuster",
  CARRIER: "was provided by the carrier",
};

function emsDraft(claim: SummaryClaim): string {
  const services = sentence(claim.mitigationServices ?? "");
  if (claim.mitigationEngagedBy === "NONE") {
    return [
      "N/A. No mitigation company was used by the insured or the Public Adjuster, and none was provided by the carrier.",
      services,
    ]
      .filter(Boolean)
      .join(" ");
  }
  const contact = claim.contacts[0];
  const company = claim.mitigationCompany?.trim() || contact?.company?.trim() || contact?.name.trim() || "";
  if (!company) return services;
  const engaged = ENGAGED_WORDING[claim.mitigationEngagedBy ?? ""] ?? "was retained";
  const started = claim.mitigationStartDate ? ` and began work on ${longDate(claim.mitigationStartDate)}` : "";
  return [
    `${company} ${engaged}${started}.`,
    services ? `Services performed: ${services}` : "",
    "The mitigation invoice, drying logs, and photographs have been requested for submission to the carrier.",
  ]
    .filter(Boolean)
    .join(" ");
}

function aleDraft(claim: SummaryClaim, coverageD: string): string {
  const details = sentence(claim.aleDetails ?? "");
  if (claim.homeHabitable === true) {
    return ["The home is fully habitable; no Additional Living Expense(s) anticipated.", details]
      .filter(Boolean)
      .join(" ");
  }
  if (claim.homeHabitable === false) {
    return [
      "The home is not habitable as a result of the loss.",
      details,
      coverageD ? `The Coverage D limit is ${coverageD.replace("$ ", "$")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return details;
}

function pickKnown<K extends string>(value: unknown, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (!value || typeof value !== "object") return out;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string") out[key] = record[key] as string;
  }
  return out;
}

function toSaved(claim: SummaryClaim): SummaryReportSaved | null {
  const r = claim.summaryReport;
  if (!r) return null;
  return {
    header: pickKnown<SummaryHeaderKey>(r.header, SUMMARY_HEADER_KEYS),
    sections: pickKnown<SummaryTextKey>(r.sections, SUMMARY_TEXT_KEYS),
    status: r.status === "FINAL" ? "FINAL" : "DRAFT",
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: r.updatedBy?.name ?? null,
    updatedVia: r.updatedVia,
  };
}

export async function loadSummaryReportPayload(
  where: { id: string } | { claimNumber: string }
): Promise<(SummaryReportPayload & { assignedAdjusterId: string | null }) | null> {
  const claim = await prisma.claim.findUnique({ where, include: summaryClaimInclude });
  if (!claim) return null;
  return {
    claim: { id: claim.id, claimNumber: claim.claimNumber, isArchived: claim.isArchived },
    auto: buildAuto(claim),
    saved: toSaved(claim),
    assignedAdjusterId: claim.assignedAdjusterId,
  };
}

export const summaryReportInputSchema = z.object({
  header: z.record(z.string().max(1000)).default({}),
  sections: z.record(z.string().max(30000)).default({}),
  status: z.enum(["DRAFT", "FINAL"]).default("DRAFT"),
});

export type SummaryReportInput = z.infer<typeof summaryReportInputSchema>;

export async function saveSummaryReport(opts: {
  claimId: string;
  actorId: string;
  via: "BLACKBOX" | "BLACKLETTER";
  input: SummaryReportInput;
}): Promise<void> {
  const header: Partial<SummaryHeaderValues> = {};
  for (const key of SUMMARY_HEADER_KEYS) {
    const v = opts.input.header[key]?.trim();
    if (v) header[key] = v;
  }
  const sections: Partial<SummaryTextValues> = {};
  for (const key of SUMMARY_TEXT_KEYS) {
    const v = opts.input.sections[key];
    if (typeof v === "string") sections[key] = v.replace(/\s+$/, "");
  }
  const status: SummaryReportStatus = opts.input.status;

  const existing = await prisma.claimSummaryReport.findUnique({
    where: { claimId: opts.claimId },
    select: { id: true, status: true },
  });
  const report = await prisma.claimSummaryReport.upsert({
    where: { claimId: opts.claimId },
    create: {
      claimId: opts.claimId,
      header,
      sections,
      status,
      updatedVia: opts.via,
      createdById: opts.actorId,
      updatedById: opts.actorId,
    },
    update: { header, sections, status, updatedVia: opts.via, updatedById: opts.actorId },
    include: { claim: { select: { claimNumber: true } } },
  });

  const verb = !existing
    ? "Started"
    : existing.status !== status && status === "FINAL"
      ? "Finalized"
      : "Updated";
  await logClaimAudit({
    claimId: opts.claimId,
    actorId: opts.actorId,
    action: "SUMMARY_REPORT_UPDATE",
    entityType: "ClaimSummaryReport",
    entityId: report.id,
    summary: `${verb} the summary report on ${report.claim.claimNumber}${
      opts.via === "BLACKLETTER" ? " from BLACKLETTER" : ""
    }`,
    meta: { via: opts.via, status },
  });
}
