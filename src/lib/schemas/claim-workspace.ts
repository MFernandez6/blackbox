import { z } from "zod";

export const contactKindEnum = z.enum([
  "VENDOR",
  "CONTRACTOR",
  "MITIGATION",
  "ENGINEER",
  "ATTORNEY",
  "OTHER",
]);

export const taskStatusEnum = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
]);

export const emailDirectionEnum = z.enum(["INBOUND", "OUTBOUND"]);

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && v.trim() ? v : null));

export const claimDatesUpdateSchema = z.object({
  initialContactDate: optionalDate,
  scheduledAppointmentDate: optionalDate,
  lossInspectedDate: optionalDate,
  estimateCreatedDate: optionalDate,
  reportCreatedDate: optionalDate,
  estimateSentDate: optionalDate,
});

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null));

const optionalInt = (min: number, max: number) =>
  z.number().int().min(min).max(max).optional().nullable().transform((v) => v ?? null);

const optionalBool = z.boolean().optional().nullable().transform((v) => v ?? null);

export const claimReportDetailsSchema = z.object({
  certifiedPolicyRequestedDate: optionalDate,
  certifiedPolicyReceivedDate: optionalDate,
  dwellingType: optionalText(200),
  stories: optionalInt(1, 200),
  constructionType: optionalText(300),
  roofCovering: optionalText(300),
  yearBuilt: optionalInt(1700, 2200),
  occupancy: z
    .enum(["OWNER_OCCUPIED", "TENANT_OCCUPIED", "SEASONAL", "VACANT"])
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  inspectionAttendees: optionalText(500),
  originOfLoss: optionalText(500),
  priorLosses: optionalText(5000),
  moldObserved: optionalBool,
  contentsDamaged: optionalBool,
  mitigationCompany: optionalText(200),
  mitigationEngagedBy: z
    .enum(["INSURED", "PUBLIC_ADJUSTER", "CARRIER", "NONE"])
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  mitigationStartDate: optionalDate,
  mitigationServices: optionalText(5000),
  homeHabitable: optionalBool,
  aleDetails: optionalText(5000),
  subrogationNotes: optionalText(5000),
});

export const claimContactCreateSchema = z.object({
  claimId: z.string().min(1),
  kind: contactKindEnum,
  name: z.string().min(1, "Name is required"),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const claimContactUpdateSchema = claimContactCreateSchema
  .omit({ claimId: true })
  .extend({ id: z.string().min(1) });

export const claimTaskCreateSchema = z.object({
  claimId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  dueDate: optionalDate,
  assignedToId: z.string().optional().nullable(),
  status: taskStatusEnum.optional().default("OPEN"),
});

export const claimTaskUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueDate: optionalDate,
  assignedToId: z.string().optional().nullable(),
  status: taskStatusEnum.optional(),
});

export const claimNoteCreateSchema = z.object({
  claimId: z.string().min(1),
  body: z.string().min(1, "Note body is required"),
});

export const claimEmailCreateSchema = z.object({
  claimId: z.string().min(1),
  direction: emailDirectionEnum,
  subject: z.string().min(1, "Subject is required"),
  fromAddress: z.string().min(1, "From is required"),
  toAddress: z.string().min(1, "To is required"),
  ccAddress: z.string().optional().nullable(),
  body: z.string().min(1, "Body is required"),
  emailDate: z.string().min(1, "Email date is required"),
  signatoryId: z.enum(["miguel", "rosie"]).optional(),
});

export type ClaimDatesUpdateInput = z.infer<typeof claimDatesUpdateSchema>;
export type ClaimContactCreateInput = z.infer<typeof claimContactCreateSchema>;
export type ClaimTaskCreateInput = z.input<typeof claimTaskCreateSchema>;
export type ClaimNoteCreateInput = z.infer<typeof claimNoteCreateSchema>;
export type ClaimEmailCreateInput = z.infer<typeof claimEmailCreateSchema>;
