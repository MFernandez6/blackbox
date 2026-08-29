import type {
  ClaimStatus,
  LossType,
  DocType,
  PaymentType,
  PreferredContactMethod,
  ContactKind,
  TaskStatus,
  EmailDirection,
  AdjusterRole,
  PolicyLine,
} from "@prisma/client";
import type { CarrierExpertInput } from "@/lib/schemas/claim";
import type { PolicyLimitRow } from "@/lib/policy-extraction";

export type ClaimPolicyDetail = {
  id: string;
  line: PolicyLine;
  label: string | null;
  policyNumber: string | null;
  carrierName: string | null;
  namedInsured: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  limits: PolicyLimitRow[];
  deductibleNotes: string | null;
  exclusions: string | null;
  endorsements: string | null;
  analysis: string | null;
  premium: string | null;
  documentId: string | null;
  parsedAt: string | null;
  isPrimary: boolean;
};

export type ClaimDetailData = {
  id: string;
  claimNumber: string;
  insurerClaimNumber: string | null;
  status: ClaimStatus;
  lossType: LossType;
  dateOfLoss: string;
  propertyAddress: string;
  zipCode: string;
  county: string;
  lossDescription: string | null;
  policyNumber: string | null;
  carrierName: string | null;
  deskExaminerName: string | null;
  deskExaminerPhone: string | null;
  deskExaminerEmail: string | null;
  fieldAdjusterName: string | null;
  fieldAdjusterPhone: string | null;
  fieldAdjusterEmail: string | null;
  experts: CarrierExpertInput[];
  coverageALimit: string | null;
  coverageBLimit: string | null;
  coverageCLimit: string | null;
  coverageDLimit: string | null;
  policyExclusions: string | null;
  policyEndorsements: string | null;
  coverageAnalysis: string | null;
  policyParsedAt: string | null;
  policies: ClaimPolicyDetail[];
  estimatedValue: string | null;
  demandAmount: string | null;
  demandSentDate: string | null;
  rcvAmount: string | null;
  acvAmount: string | null;
  settlementAmount: string | null;
  settlementDate: string | null;
  settlementNotes: string | null;
  isCatClaim: boolean;
  contingencyFeePercent: string;
  assignedAdjusterId: string | null;
  initialContactDate: string | null;
  scheduledAppointmentDate: string | null;
  lossInspectedDate: string | null;
  estimateCreatedDate: string | null;
  reportCreatedDate: string | null;
  estimateSentDate: string | null;
  isArchived: boolean;
  createdAt: string;
  claimants: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    mailingAddress: string;
    preferredContactMethod: PreferredContactMethod;
    isPrimaryContact: boolean;
  }>;
  statusHistory: Array<{
    id: string;
    previousStatus: ClaimStatus | null;
    newStatus: ClaimStatus;
    changedAt: string;
    note: string | null;
    changedByName: string;
  }>;
  documents: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    docType: DocType;
    uploadedAt: string;
    uploaderName: string;
    extractionStatus: string;
    policyLine: PolicyLine | null;
    isCertifiedPolicy: boolean;
    displayPath: string | null;
  }>;
  auditEvents: Array<{
    id: string;
    action: string;
    entityType: string;
    summary: string;
    createdAt: string;
    actorName: string;
  }>;
  payments: Array<{
    id: string;
    type: PaymentType;
    amount: string;
    date: string;
    note: string | null;
    recordedByName: string;
  }>;
  contacts: Array<{
    id: string;
    kind: ContactKind;
    name: string;
    company: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    dueDate: string | null;
    assignedToId: string | null;
    assignedToName: string | null;
    createdByName: string;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    createdByName: string;
    createdAt: string;
  }>;
  emails: Array<{
    id: string;
    direction: EmailDirection;
    subject: string;
    fromAddress: string;
    toAddress: string;
    ccAddress: string | null;
    body: string;
    emailDate: string;
    createdByName: string;
  }>;
};

export type AdjusterOption = { id: string; name: string };

export type ClaimWorkspaceProps = {
  claim: ClaimDetailData;
  adjusters: AdjusterOption[];
  role: AdjusterRole;
  editable: boolean;
};
