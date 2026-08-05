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
});

export type ClaimDatesUpdateInput = z.infer<typeof claimDatesUpdateSchema>;
export type ClaimContactCreateInput = z.infer<typeof claimContactCreateSchema>;
export type ClaimTaskCreateInput = z.input<typeof claimTaskCreateSchema>;
export type ClaimNoteCreateInput = z.infer<typeof claimNoteCreateSchema>;
export type ClaimEmailCreateInput = z.infer<typeof claimEmailCreateSchema>;
