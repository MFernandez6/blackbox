import type { ClaimStatus, DocType } from "@prisma/client";

export type LetterDocumentType =
  | "LOR"
  | "PA_CONTRACT"
  | "CLIENT_DISCLOSURE"
  | "AOB"
  | "NOTICE_OF_CLAIM"
  | "PROOF_OF_LOSS"
  | "SCOPE_LETTER"
  | "DEMAND_LETTER"
  | "SUPPLEMENTAL"
  | "EUO_LETTER"
  | "APPRAISAL_DEMAND"
  | "MEDIATION_REQUEST"
  | "SETTLEMENT_AGREEMENT"
  | "FULL_FINAL_RELEASE"
  | "CLOSING_STATEMENT"
  | "FEE_INVOICE"
  | "EXTENSION_REQUEST"
  | "WITHDRAWAL"
  | "STATUS_UPDATE";

export type LifecycleStage =
  | "INTAKE_ENGAGEMENT"
  | "NOTICE_FILING"
  | "NEGOTIATION"
  | "RESOLUTION"
  | "ADMINISTRATIVE";

export const DOCUMENT_TYPE_LABELS: Record<LetterDocumentType, string> = {
  LOR: "Letter of Representation",
  PA_CONTRACT: "PA Contract of Employment",
  CLIENT_DISCLOSURE: "Client / engagement disclosure",
  AOB: "Assignment of Benefits",
  NOTICE_OF_CLAIM: "Notice of Claim / Representation",
  PROOF_OF_LOSS: "Sworn Statement in Proof of Loss",
  SCOPE_LETTER: "Preliminary damage estimate / scope letter",
  DEMAND_LETTER: "Demand letter / Reservation of Rights response",
  SUPPLEMENTAL: "Supplemental claim submission",
  EUO_LETTER: "EUO response / prep letter",
  APPRAISAL_DEMAND: "Appraisal demand letter",
  MEDIATION_REQUEST: "Mediation request",
  SETTLEMENT_AGREEMENT: "Settlement agreement / Release of all claims",
  FULL_FINAL_RELEASE: "Full and Final Release",
  CLOSING_STATEMENT: "Closing statement / disbursement breakdown",
  FEE_INVOICE: "Contingency fee invoice",
  EXTENSION_REQUEST: "Extension request letter",
  WITHDRAWAL: "Withdrawal of representation",
  STATUS_UPDATE: "Client status update",
};

export const STAGE_LABELS: Record<LifecycleStage, string> = {
  INTAKE_ENGAGEMENT: "Intake / engagement",
  NOTICE_FILING: "Notice / filing",
  NEGOTIATION: "Negotiation",
  RESOLUTION: "Resolution",
  ADMINISTRATIVE: "Administrative",
};

export const STAGES_FOR_STATUS: Record<ClaimStatus, LifecycleStage[]> = {
  INTAKE: ["INTAKE_ENGAGEMENT"],
  UNDER_REVIEW: ["INTAKE_ENGAGEMENT"],
  INVESTIGATION: ["INTAKE_ENGAGEMENT", "NOTICE_FILING"],
  FILED: ["INTAKE_ENGAGEMENT", "NOTICE_FILING"],
  NEGOTIATING: ["INTAKE_ENGAGEMENT", "NOTICE_FILING", "NEGOTIATION"],
  DENIED: ["INTAKE_ENGAGEMENT", "NOTICE_FILING", "NEGOTIATION"],
  SETTLED: ["INTAKE_ENGAGEMENT", "NOTICE_FILING", "NEGOTIATION", "RESOLUTION"],
  CLOSED: ["INTAKE_ENGAGEMENT", "NOTICE_FILING", "NEGOTIATION", "RESOLUTION"],
};

type StageMapRow = {
  documentType: LetterDocumentType;
  stage: LifecycleStage;
  sortOrder: number;
  required: boolean;
  aobOnly: boolean;
};

/** Same BLACKLETTER library map — used when the live API is down. */
export const DEFAULT_STAGE_MAP: StageMapRow[] = [
  { documentType: "LOR", stage: "INTAKE_ENGAGEMENT", sortOrder: 10, required: true, aobOnly: false },
  { documentType: "PA_CONTRACT", stage: "INTAKE_ENGAGEMENT", sortOrder: 20, required: true, aobOnly: false },
  { documentType: "CLIENT_DISCLOSURE", stage: "INTAKE_ENGAGEMENT", sortOrder: 30, required: true, aobOnly: false },
  { documentType: "AOB", stage: "INTAKE_ENGAGEMENT", sortOrder: 40, required: true, aobOnly: true },
  { documentType: "NOTICE_OF_CLAIM", stage: "NOTICE_FILING", sortOrder: 10, required: true, aobOnly: false },
  { documentType: "PROOF_OF_LOSS", stage: "NOTICE_FILING", sortOrder: 20, required: true, aobOnly: false },
  { documentType: "SCOPE_LETTER", stage: "NOTICE_FILING", sortOrder: 30, required: false, aobOnly: false },
  { documentType: "DEMAND_LETTER", stage: "NEGOTIATION", sortOrder: 10, required: true, aobOnly: false },
  { documentType: "SUPPLEMENTAL", stage: "NEGOTIATION", sortOrder: 20, required: false, aobOnly: false },
  { documentType: "EUO_LETTER", stage: "NEGOTIATION", sortOrder: 30, required: false, aobOnly: false },
  { documentType: "APPRAISAL_DEMAND", stage: "NEGOTIATION", sortOrder: 40, required: false, aobOnly: false },
  { documentType: "MEDIATION_REQUEST", stage: "NEGOTIATION", sortOrder: 50, required: false, aobOnly: false },
  { documentType: "SETTLEMENT_AGREEMENT", stage: "RESOLUTION", sortOrder: 10, required: true, aobOnly: false },
  { documentType: "FULL_FINAL_RELEASE", stage: "RESOLUTION", sortOrder: 20, required: true, aobOnly: false },
  { documentType: "CLOSING_STATEMENT", stage: "RESOLUTION", sortOrder: 30, required: true, aobOnly: false },
  { documentType: "FEE_INVOICE", stage: "RESOLUTION", sortOrder: 40, required: true, aobOnly: false },
];

export type ExistingLetterDoc = {
  documentType: LetterDocumentType;
  status: "draft" | "sent" | "signed" | "executed";
  source: "BLACKGATE" | "BLACKLETTER" | "VAULT";
};

export type NextDocumentItem = {
  documentType: LetterDocumentType;
  name: string;
  stage: LifecycleStage;
  required: boolean;
  reason: string;
  alreadyOnFile: boolean;
  onFileSource: "BLACKGATE" | "BLACKLETTER" | "VAULT" | null;
  onFileStatus: string | null;
};

export type NextDocumentResult = {
  claimId: string;
  claimNumber: string;
  claimStatus: ClaimStatus;
  next: NextDocumentItem | null;
  due: NextDocumentItem[];
  complete: boolean;
  source: "BLACKLETTER" | "BLACKBOX";
};

function isSatisfied(status: ExistingLetterDoc["status"]) {
  return status === "signed" || status === "executed";
}

function bestExisting(type: LetterDocumentType, existing: ExistingLetterDoc[]) {
  const rows = existing.filter((e) => e.documentType === type);
  return (
    rows.find((r) => r.status === "executed") ??
    rows.find((r) => r.status === "signed") ??
    rows.find((r) => r.status === "sent") ??
    rows[0]
  );
}

export function computeNextDocument(input: {
  claimId: string;
  claimNumber: string;
  claimStatus: ClaimStatus;
  aobApplicable?: boolean;
  existing: ExistingLetterDoc[];
}): NextDocumentResult {
  const dueStages = STAGES_FOR_STATUS[input.claimStatus] ?? ["INTAKE_ENGAGEMENT"];
  const aob = Boolean(input.aobApplicable);

  const candidates = DEFAULT_STAGE_MAP.filter((row) => {
    if (row.stage === "ADMINISTRATIVE") return false;
    if (row.aobOnly && !aob) return false;
    return dueStages.includes(row.stage);
  }).sort((a, b) => {
    const sa = dueStages.indexOf(a.stage);
    const sb = dueStages.indexOf(b.stage);
    if (sa !== sb) return sa - sb;
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });

  const due: NextDocumentItem[] = candidates.map((row) => {
    const found = bestExisting(row.documentType, input.existing);
    const onFile = Boolean(found && isSatisfied(found.status));
    return {
      documentType: row.documentType,
      name: DOCUMENT_TYPE_LABELS[row.documentType],
      stage: row.stage,
      required: row.required,
      reason: row.aobOnly
        ? "AOB applies to this claim type — generate only if assignment is in play."
        : row.required
          ? `Required at ${STAGE_LABELS[row.stage].toLowerCase()} while the file is ${input.claimStatus.replaceAll("_", " ").toLowerCase()}.`
          : `Available at ${STAGE_LABELS[row.stage].toLowerCase()}.`,
      alreadyOnFile: onFile,
      onFileSource: found ? found.source : null,
      onFileStatus: found?.status ?? null,
    };
  });

  const next =
    due.find((d) => d.required && !d.alreadyOnFile) ??
    due.find((d) => !d.alreadyOnFile) ??
    null;

  return {
    claimId: input.claimId,
    claimNumber: input.claimNumber,
    claimStatus: input.claimStatus,
    next,
    due,
    complete: due.filter((d) => d.required && !d.alreadyOnFile).length === 0,
    source: "BLACKBOX",
  };
}

const LETTER_TYPES = new Set<string>(Object.keys(DOCUMENT_TYPE_LABELS));

export function inferLetterType(opts: {
  fileName: string;
  docType: DocType;
  extractedType?: string | null;
}): LetterDocumentType | null {
  if (opts.extractedType && LETTER_TYPES.has(opts.extractedType)) {
    return opts.extractedType as LetterDocumentType;
  }
  if (opts.docType === "DEMAND_LETTER") return "DEMAND_LETTER";
  if (opts.docType === "ESTIMATE") return "SCOPE_LETTER";

  const name = opts.fileName.toLowerCase();
  if (/\blor\b|letter of representation|representation/.test(name)) return "LOR";
  if (/pa contract|contract of employment|fee agreement/.test(name)) return "PA_CONTRACT";
  if (/disclosure|engagement/.test(name)) return "CLIENT_DISCLOSURE";
  if (/\baob\b|assignment of benefits/.test(name)) return "AOB";
  if (/notice of claim|notice of representation/.test(name)) return "NOTICE_OF_CLAIM";
  if (/proof of loss/.test(name)) return "PROOF_OF_LOSS";
  if (/scope letter|preliminary (damage )?estimate/.test(name)) return "SCOPE_LETTER";
  if (/demand/.test(name)) return "DEMAND_LETTER";
  if (/supplement/.test(name)) return "SUPPLEMENTAL";
  if (/\beuo\b/.test(name)) return "EUO_LETTER";
  if (/appraisal/.test(name)) return "APPRAISAL_DEMAND";
  if (/mediation/.test(name)) return "MEDIATION_REQUEST";
  if (/settlement agreement|release of all claims/.test(name)) return "SETTLEMENT_AGREEMENT";
  if (/full and final/.test(name)) return "FULL_FINAL_RELEASE";
  if (/closing statement|disbursement/.test(name)) return "CLOSING_STATEMENT";
  if (/fee invoice|contingency invoice/.test(name)) return "FEE_INVOICE";
  return null;
}
