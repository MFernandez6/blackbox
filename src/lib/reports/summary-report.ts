// Kept byte-identical with blackletter/src/lib/reports/summary-report.ts so both
// apps print the same report. Pure module: no server imports.

export const SUMMARY_REPORT_TITLE = "SUMMARY REPORT";

/** Blank date left in auto-drafted text; the checklist keeps the section open until it is filled in. */
export const SUMMARY_DATE_BLANK = "__/__/____";

export const SUMMARY_REPORT_BRAND = {
  name: "Blackline Public Adjusters LLC",
  address: "100 Biscayne Boulevard, Suite 500, Miami, FL 33132",
  website: "blacklineadjusting.com",
  tagline: "Licensed Public Adjusters · Prepared on behalf of the named insured",
  logoPath: "/brand/blackline-logo.png",
} as const;

export type SummaryHeaderKey =
  | "reportDate"
  | "claimNumber"
  | "carrierClaimNumber"
  | "insured"
  | "fieldAdjuster"
  | "dateOfLoss"
  | "dateInspected"
  | "taskCompleted"
  | "riskAddress"
  | "mailingAddress"
  | "carrier"
  | "policyNumber"
  | "formType"
  | "policyType"
  | "effectiveDate"
  | "coverageA"
  | "coverageB"
  | "coverageC"
  | "coverageD";

export type SummaryHeaderField = {
  key: SummaryHeaderKey;
  label: string;
  group: "report" | "assignment" | "coverage" | "limits";
  upper?: boolean;
  /** Row is left off the printed report when blank. */
  optional?: boolean;
};

export const SUMMARY_HEADER_FIELDS: SummaryHeaderField[] = [
  { key: "reportDate", label: "Report Date", group: "report" },
  { key: "claimNumber", label: "Claim Number", group: "assignment" },
  { key: "carrierClaimNumber", label: "Carrier Claim Number", group: "assignment", optional: true },
  { key: "insured", label: "Insured", group: "assignment", upper: true },
  { key: "fieldAdjuster", label: "Field Adjuster", group: "assignment", upper: true },
  { key: "dateOfLoss", label: "Date of Loss", group: "assignment", optional: true },
  { key: "dateInspected", label: "Date Inspected", group: "assignment" },
  { key: "taskCompleted", label: "Task Completed", group: "assignment" },
  { key: "riskAddress", label: "Risk Address", group: "assignment", upper: true },
  { key: "mailingAddress", label: "Mailing Address", group: "assignment", upper: true },
  { key: "carrier", label: "Carrier", group: "coverage", optional: true },
  { key: "policyNumber", label: "Policy Number", group: "coverage", optional: true },
  { key: "formType", label: "Form Type", group: "coverage" },
  { key: "policyType", label: "Policy Type", group: "coverage" },
  { key: "effectiveDate", label: "Effective Date", group: "coverage" },
  { key: "coverageA", label: "Coverage A", group: "limits" },
  { key: "coverageB", label: "Coverage B", group: "limits" },
  { key: "coverageC", label: "Coverage C", group: "limits" },
  { key: "coverageD", label: "Coverage D", group: "limits" },
];

export type SummaryTextKey =
  | "assignmentNotes"
  | "riskOccupancy"
  | "inspection"
  | "causeOfLoss"
  | "causeOfLossStatement"
  | "originOfLoss"
  | "recommendations"
  | "riskAlert"
  | "damages"
  | "nonRelatedDamage"
  | "priorLosses"
  | "mold"
  | "contents"
  | "ems"
  | "ale"
  | "subrogation";

export type SummaryTextField = {
  key: SummaryTextKey;
  title: string;
  format: "paragraphs" | "bullets" | "rooms" | "inline";
  hint: string;
  rows: number;
};

export const SUMMARY_TEXT_FIELDS: SummaryTextField[] = [
  {
    key: "assignmentNotes",
    title: "Field assignment notes",
    format: "bullets",
    hint: "One bullet per line: initial contact with the insured, inspection date, carrier field adjuster and desk adjuster (claims examiner), and the date the certified policy was requested. Replace any __/__/____ with the date.",
    rows: 5,
  },
  {
    key: "riskOccupancy",
    title: "RISK AND OCCUPANCY DESCRIPTION",
    format: "paragraphs",
    hint: "Structure type, stories, construction, roof covering, occupancy, and conditions observed on arrival.",
    rows: 5,
  },
  {
    key: "inspection",
    title: "INSPECTION",
    format: "paragraphs",
    hint: "Date, who was present, areas inspected and photographed, conditions observed, mitigation present.",
    rows: 8,
  },
  {
    key: "causeOfLoss",
    title: "CAUSE OF LOSS",
    format: "paragraphs",
    hint: "What the observed conditions are consistent with, and what further evidence is needed.",
    rows: 6,
  },
  {
    key: "causeOfLossStatement",
    title: "Cause of Loss",
    format: "inline",
    hint: "One line, e.g. Water intrusion through the roof system.",
    rows: 2,
  },
  {
    key: "originOfLoss",
    title: "Origin of Loss",
    format: "inline",
    hint: "One line, e.g. Roof assembly above the living room/kitchen area.",
    rows: 2,
  },
  {
    key: "recommendations",
    title: "FIELD ADJUSTER RECOMMENDATION(S)",
    format: "paragraphs",
    hint: "Findings summary, scope recommendation, estimate status, and next steps (engineer, roofer, leak detection).",
    rows: 7,
  },
  {
    key: "riskAlert",
    title: "RISK ALERT",
    format: "paragraphs",
    hint: "Safety or habitability concerns, or “No risk concerns observed at the time of inspection.”",
    rows: 2,
  },
  {
    key: "damages",
    title: "DAMAGE(S)",
    format: "rooms",
    hint: "One area per line or paragraph, starting with the area name: LIVING ROOM: findings…",
    rows: 10,
  },
  {
    key: "nonRelatedDamage",
    title: "NON-RELATED DAMAGE",
    format: "paragraphs",
    hint: "Pre-existing, wear and tear, or unrelated conditions observed — or that none were identified.",
    rows: 4,
  },
  {
    key: "priorLosses",
    title: "PRIOR LOSSES",
    format: "paragraphs",
    hint: "Prior claims or damage at the risk reported by the insured, prior repairs, and whether they overlap this loss. N/A if none.",
    rows: 3,
  },
  {
    key: "mold",
    title: "MOLD",
    format: "paragraphs",
    hint: "Visible microbial growth, testing, and the policy mold sublimit if it applies.",
    rows: 3,
  },
  {
    key: "contents",
    title: "CONTENTS",
    format: "paragraphs",
    hint: "Personal property damaged, inventory status, and documentation requested (Coverage C).",
    rows: 5,
  },
  {
    key: "ems",
    title: "EMERGENCY MITIGATION SERVICES (EMS)",
    format: "paragraphs",
    hint: "Confirm the mitigation company and who engaged it — selected/contracted by the insured or PA, or provided by the carrier — plus services performed (tarp, dry-out, pack-out) and invoices/drying logs requested. N/A if none.",
    rows: 5,
  },
  {
    key: "ale",
    title: "ADDITIONAL LIVING EXPENSE (ALE)",
    format: "paragraphs",
    hint: "Habitability and any Coverage D / loss of use being claimed.",
    rows: 3,
  },
  {
    key: "subrogation",
    title: "SUBROGATION/SALVAGE",
    format: "paragraphs",
    hint: "Third-party involvement (contractor, manufacturer, neighbor, HOA) or salvage potential.",
    rows: 3,
  },
];

export type SummaryPolicyLine = {
  title: string;
  detail: string;
  limits: Array<{ label: string; amount: string }>;
};

export type SummaryHeaderValues = Record<SummaryHeaderKey, string>;
export type SummaryTextValues = Record<SummaryTextKey, string>;

export type SummaryReportAuto = {
  header: SummaryHeaderValues;
  sections: SummaryTextValues;
  otherPolicies: SummaryPolicyLine[];
};

export type SummaryReportStatus = "DRAFT" | "FINAL";

export type SummaryReportSaved = {
  header: Partial<SummaryHeaderValues>;
  sections: Partial<SummaryTextValues>;
  status: SummaryReportStatus;
  updatedAt: string;
  updatedBy: string | null;
  updatedVia: string;
};

export type SummaryReportPayload = {
  claim: { id: string; claimNumber: string; isArchived: boolean };
  auto: SummaryReportAuto;
  saved: SummaryReportSaved | null;
};

export type SummaryReportView = {
  header: SummaryHeaderValues;
  sections: SummaryTextValues;
  otherPolicies: SummaryPolicyLine[];
  status: SummaryReportStatus;
};

export const SUMMARY_HEADER_KEYS = SUMMARY_HEADER_FIELDS.map((f) => f.key);
export const SUMMARY_TEXT_KEYS = SUMMARY_TEXT_FIELDS.map((f) => f.key);

export function emptyHeaderValues(): SummaryHeaderValues {
  return Object.fromEntries(SUMMARY_HEADER_KEYS.map((k) => [k, ""])) as SummaryHeaderValues;
}

export function emptyTextValues(): SummaryTextValues {
  return Object.fromEntries(SUMMARY_TEXT_KEYS.map((k) => [k, ""])) as SummaryTextValues;
}

/** Text the editor starts from: saved section text, else the auto draft. */
export function initialSectionText(payload: SummaryReportPayload): SummaryTextValues {
  const out = emptyTextValues();
  for (const key of SUMMARY_TEXT_KEYS) {
    const saved = payload.saved?.sections[key];
    out[key] = saved !== undefined ? saved : payload.auto.sections[key] ?? "";
  }
  return out;
}

/** Header overrides win when non-blank; blank falls back to live claim data. */
export function resolveSummaryReport(
  payload: SummaryReportPayload,
  draft?: {
    header: Partial<SummaryHeaderValues>;
    sections: SummaryTextValues;
    status?: SummaryReportStatus;
  }
): SummaryReportView {
  const overrides = draft?.header ?? payload.saved?.header ?? {};
  const header = emptyHeaderValues();
  for (const key of SUMMARY_HEADER_KEYS) {
    const override = overrides[key]?.trim();
    header[key] = override || payload.auto.header[key] || "";
  }
  return {
    header,
    sections: draft?.sections ?? initialSectionText(payload),
    otherPolicies: payload.auto.otherPolicies,
    status: draft?.status ?? payload.saved?.status ?? "DRAFT",
  };
}

export type SummaryChecklistItem = { key: string; title: string; complete: boolean };

/** One row per report section so nothing (especially coverage) is skipped. */
export function summaryReportChecklist(view: SummaryReportView): SummaryChecklistItem[] {
  const has = (v: string | undefined) => Boolean(v && v.trim() && !v.includes(SUMMARY_DATE_BLANK));
  const h = view.header;
  const s = view.sections;
  const items: SummaryChecklistItem[] = [
    {
      key: "assignment",
      title: "FIELD ASSIGNMENT",
      complete:
        has(h.insured) &&
        has(h.dateInspected) &&
        has(h.taskCompleted) &&
        has(h.riskAddress) &&
        has(s.assignmentNotes),
    },
    {
      key: "coverage",
      title: "COVERAGE",
      complete:
        has(h.formType) &&
        has(h.policyType) &&
        has(h.effectiveDate) &&
        (has(h.coverageA) || view.otherPolicies.length > 0),
    },
    {
      key: "causeOfLoss",
      title: "CAUSE OF LOSS",
      complete: has(s.causeOfLoss) && has(s.causeOfLossStatement) && has(s.originOfLoss),
    },
  ];
  for (const field of SUMMARY_TEXT_FIELDS) {
    if (
      field.key === "assignmentNotes" ||
      field.key === "causeOfLoss" ||
      field.key === "causeOfLossStatement" ||
      field.key === "originOfLoss"
    ) {
      continue;
    }
    items.push({ key: field.key, title: field.title, complete: has(s[field.key]) });
  }
  const order = [
    "assignment",
    "coverage",
    "riskOccupancy",
    "inspection",
    "causeOfLoss",
    "recommendations",
    "riskAlert",
    "damages",
    "nonRelatedDamage",
    "priorLosses",
    "mold",
    "contents",
    "ems",
    "ale",
    "subrogation",
  ];
  return order
    .map((key) => items.find((i) => i.key === key))
    .filter((i): i is SummaryChecklistItem => Boolean(i));
}

export function summaryReportFileName(claimNumber: string): string {
  return `${claimNumber} Summary Report`;
}

// ---------------------------------------------------------------------------
// HTML renderer
// ---------------------------------------------------------------------------

const PENDING = "Pending review — complete before issuing.";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pending(): string {
  return `<p class="pending">${PENDING}</p>`;
}

function prose(value: string): string {
  return esc(value).split(SUMMARY_DATE_BLANK).join(`<span class="pending">${SUMMARY_DATE_BLANK}</span>`);
}

function paragraphs(text: string): string {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return pending();
  return blocks.map((b) => `<p>${prose(b).replace(/\n/g, "<br />")}</p>`).join("");
}

function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[•\-*·]|\d+[.)])\s+/, "").trim();
}

function bullets(text: string): string {
  const lines = text
    .split(/\n/)
    .map(stripBullet)
    .filter(Boolean);
  if (lines.length === 0) return pending();
  return `<ul>${lines.map((l) => `<li>${prose(l)}</li>`).join("")}</ul>`;
}

const ROOM_LABEL = /^([A-Z0-9][A-Z0-9 /&'’().,#-]{1,60}):\s*(.*)$/;

export function splitDamageItems(text: string): Array<{ area: string | null; body: string }> {
  const items: Array<{ area: string | null; body: string }> = [];
  let current: { area: string | null; body: string } | null = null;
  let blank = true;
  for (const raw of text.split(/\n/)) {
    const line = stripBullet(raw);
    if (!line) {
      blank = true;
      continue;
    }
    const match = line.match(ROOM_LABEL);
    if (match || blank || !current) {
      current = match
        ? { area: match[1].trim(), body: match[2].trim() }
        : { area: null, body: line };
      items.push(current);
    } else {
      current.body = `${current.body} ${line}`.trim();
    }
    blank = false;
  }
  return items;
}

function rooms(text: string): string {
  const items = splitDamageItems(text);
  if (items.length === 0) return pending();
  return `<ul>${items
    .map((i) =>
      i.area
        ? `<li><strong>${esc(i.area.toUpperCase())}:</strong> ${prose(i.body)}</li>`
        : `<li>${prose(i.body)}</li>`
    )
    .join("")}</ul>`;
}

function headerRow(field: SummaryHeaderField, value: string): string {
  const v = value.trim();
  if (!v && field.optional) return "";
  const shown = v
    ? esc(field.upper ? v.toUpperCase() : v)
    : `<span class="pending">Pending</span>`;
  return `<dt>${esc(field.label)}:</dt><dd>${shown}</dd>`;
}

function section(title: string, body: string): string {
  return `<section><h2>${esc(title)}:</h2>${body}</section>`;
}

export const SUMMARY_REPORT_CSS = `
.bl-report{background:#fff;color:#141414;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.45;font-variant-numeric:lining-nums;width:100%;max-width:8.5in;margin:0 auto;padding:0.6in 0.8in 0.7in;box-shadow:0 1px 3px rgba(0,0,0,.25);text-align:left;overflow-wrap:break-word;-webkit-text-size-adjust:100%;text-size-adjust:100%}
.bl-report *{box-sizing:border-box}
.bl-report .bl-lh{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:12px;border-bottom:2px solid #C6A85B}
.bl-report .bl-lh img{height:70px;width:auto;max-width:60%;object-fit:contain;filter:none!important}
.bl-report .bl-firm{text-align:right;font-family:"Helvetica Neue",Arial,sans-serif;font-size:7.5pt;letter-spacing:.14em;text-transform:uppercase;color:#7a6a3a;line-height:1.7}
.bl-report .bl-firm strong{color:#5c4e24;font-weight:700}
.bl-report h1{text-align:center;font-size:14pt;font-weight:700;letter-spacing:.03em;margin:22px 0 2px;color:#141414}
.bl-report .bl-date{text-align:center;margin:0 0 10px}
.bl-report h2{font-size:12pt;font-weight:700;text-transform:uppercase;margin:18px 0 6px;color:#141414;break-after:avoid;page-break-after:avoid}
.bl-report section{break-inside:auto}
.bl-report dl{display:grid;grid-template-columns:2.1in minmax(0,1fr);gap:1px 14px;margin:0}
.bl-report dt{font-weight:700}
.bl-report dd{margin:0;min-width:0;overflow-wrap:anywhere}
.bl-report ul{margin:10px 0 0;padding-left:24px;list-style:disc}
.bl-report li{margin:0 0 4px}
.bl-report p{margin:0 0 8px}
.bl-report .bl-inline{margin:8px 0 0}
.bl-report .bl-inline strong{font-weight:700}
.bl-report .bl-limits div{white-space:nowrap}
.bl-report .bl-policy{margin:0 0 6px}
.bl-report .bl-policy small{display:block;font-size:10.5pt;color:#444}
.bl-report .pending{color:#9b2c2c;font-style:italic}
.bl-report .bl-foot{margin-top:30px;padding-top:6px;border-top:1px solid #C6A85B;font-family:"Helvetica Neue",Arial,sans-serif;font-size:7pt;letter-spacing:.14em;text-transform:uppercase;color:#8a7a4a}
@media screen and (max-width:900px){.bl-report{padding:0.5in 0.55in 0.6in;font-size:11.5pt}.bl-report dl{grid-template-columns:1.75in minmax(0,1fr)}}
@media screen and (max-width:640px){.bl-report{padding:24px 18px 28px;font-size:15px;line-height:1.55;box-shadow:0 1px 2px rgba(0,0,0,.2)}.bl-report .bl-lh{flex-direction:column;align-items:flex-start;gap:10px}.bl-report .bl-lh img{height:52px}.bl-report .bl-firm{text-align:left;font-size:9px;letter-spacing:.12em}.bl-report h1{font-size:18px;margin-top:18px}.bl-report h2{font-size:14.5px;margin-top:20px;letter-spacing:.02em}.bl-report dl{grid-template-columns:minmax(0,1fr);gap:0}.bl-report dt{margin-top:8px}.bl-report dt:first-child{margin-top:0}.bl-report ul{padding-left:20px}.bl-report .bl-limits div{white-space:normal}.bl-report .bl-policy small{font-size:13px}.bl-report .bl-foot{font-size:8.5px;letter-spacing:.1em;line-height:1.6}}
@media screen and (max-width:380px){.bl-report{padding:20px 14px 24px;font-size:14.5px}.bl-report h1{font-size:17px}}
@media print{.bl-report{box-shadow:none;max-width:none;width:auto;margin:0;padding:0;font-size:11.5pt}.bl-report .pending{color:#9b2c2c!important}}
@page{size:letter;margin:0.6in 0.75in 0.7in;@top-right{content:"Page " counter(page) " of " counter(pages);font:10pt "Times New Roman",Times,serif;color:#333}}
`;

export function renderSummaryReportHtml(
  view: SummaryReportView,
  opts: { logoSrc?: string } = {}
): string {
  const h = view.header;
  const s = view.sections;
  const field = (key: SummaryHeaderKey) =>
    SUMMARY_HEADER_FIELDS.find((f) => f.key === key) as SummaryHeaderField;
  const rowsFor = (group: SummaryHeaderField["group"]) =>
    SUMMARY_HEADER_FIELDS.filter((f) => f.group === group)
      .map((f) => headerRow(f, h[f.key]))
      .join("");

  const limitLines = SUMMARY_HEADER_FIELDS.filter((f) => f.group === "limits")
    .map((f) => {
      const v = h[f.key].trim();
      return `<div>${esc(f.label)}: ${v ? esc(v) : `<span class="pending">Not on file</span>`}</div>`;
    })
    .join("");

  const otherPolicies = view.otherPolicies.length
    ? `<dt>Other Policies on File:</dt><dd>${view.otherPolicies
        .map(
          (p) =>
            `<div class="bl-policy">${esc(p.title)}${p.detail ? ` — ${esc(p.detail)}` : ""}${
              p.limits.length
                ? `<small>${p.limits.map((l) => `${esc(l.label)}: ${esc(l.amount)}`).join(" · ")}</small>`
                : ""
            }</div>`
        )
        .join("")}</dd>`
    : "";

  const causeInline = (key: "causeOfLossStatement" | "originOfLoss", label: string) => {
    const v = s[key].trim();
    return `<p class="bl-inline"><strong>${esc(label)}:</strong> ${
      v ? esc(v).replace(/\n/g, " ") : `<span class="pending">${PENDING}</span>`
    }</p>`;
  };

  const logo = opts.logoSrc ?? SUMMARY_REPORT_BRAND.logoPath;
  const brand = SUMMARY_REPORT_BRAND;

  const parts = [
    `<style>${SUMMARY_REPORT_CSS}</style>`,
    `<article class="bl-report">`,
    `<div class="bl-lh"><img src="${esc(logo)}" alt="${esc(brand.name)}" /><div class="bl-firm"><strong>${esc(
      brand.name
    )}</strong><br />${esc(brand.address)}<br />${esc(brand.website)}</div></div>`,
    `<h1>${esc(SUMMARY_REPORT_TITLE)}</h1>`,
    `<p class="bl-date">${h.reportDate ? esc(h.reportDate) : `<span class="pending">Report date pending</span>`}</p>`,
    section("FIELD ASSIGNMENT", `<dl>${rowsFor("assignment")}</dl>${bullets(s.assignmentNotes)}`),
    section(
      "COVERAGE",
      `<dl>${rowsFor("coverage")}<dt>Limits of Liability:</dt><dd class="bl-limits">${limitLines}</dd>${otherPolicies}</dl>`
    ),
    section("RISK AND OCCUPANCY DESCRIPTION", paragraphs(s.riskOccupancy)),
    section("INSPECTION", paragraphs(s.inspection)),
    section(
      "CAUSE OF LOSS",
      `${paragraphs(s.causeOfLoss)}${causeInline("causeOfLossStatement", "Cause of Loss")}${causeInline(
        "originOfLoss",
        "Origin of Loss"
      )}`
    ),
    section("FIELD ADJUSTER RECOMMENDATION(S)", paragraphs(s.recommendations)),
    section("RISK ALERT", paragraphs(s.riskAlert)),
    section("DAMAGE(S)", rooms(s.damages)),
    section("NON-RELATED DAMAGE", paragraphs(s.nonRelatedDamage)),
    section("PRIOR LOSSES", paragraphs(s.priorLosses)),
    section("MOLD", paragraphs(s.mold)),
    section("CONTENTS", paragraphs(s.contents)),
    section("EMERGENCY MITIGATION SERVICES (EMS)", paragraphs(s.ems)),
    section("ADDITIONAL LIVING EXPENSE (ALE)", paragraphs(s.ale)),
    section("SUBROGATION/SALVAGE", paragraphs(s.subrogation)),
    `<div class="bl-foot">${esc(brand.name)} · ${esc(brand.tagline)} · ${esc(
      field("claimNumber").label
    )} ${esc(h.claimNumber)}</div>`,
    `</article>`,
  ];
  return parts.join("");
}
