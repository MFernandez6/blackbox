export const EMAIL_SIGNATURE_FENCE = "\n\n-- \n";

/** Firm block; empty values are omitted rather than shown as placeholders. */
export const FIRM_SIGNATURE = {
  name: process.env.NEXT_PUBLIC_FIRM_NAME || "Blackline Public Adjusters LLC",
  address: process.env.NEXT_PUBLIC_FIRM_ADDRESS || "",
  phone: process.env.NEXT_PUBLIC_FIRM_PHONE || "",
  website: process.env.NEXT_PUBLIC_FIRM_WEBSITE || "",
} as const;

export type EmailSignatoryId = string;

export type EmailSignatory = {
  id: EmailSignatoryId;
  name: string;
  title: string;
  email: string;
  phone: string;
  license: string | null;
};

/** Build a signatory from an Adjuster row; license and title come from the user record. */
export function signatoryFromAdjuster(a: {
  id: string;
  name: string;
  email: string;
  role: string;
  licenseNumber: string | null;
  title: string | null;
  phone: string | null;
}): EmailSignatory {
  const license = a.licenseNumber?.trim() || null;
  return {
    id: a.id,
    name: a.name,
    title: a.title?.trim() || (license ? "Licensed Public Adjuster" : "Claims Staff"),
    email: a.email,
    phone: a.phone?.trim() || FIRM_SIGNATURE.phone,
    license,
  };
}

export function emailSignatoryById(
  signatories: readonly EmailSignatory[],
  id: EmailSignatoryId | null | undefined
): EmailSignatory | null {
  return signatories.find((s) => s.id === id) ?? null;
}

export function emailSignatoryForAddress(
  signatories: readonly EmailSignatory[],
  from: string
): EmailSignatory | null {
  const value = from.trim().toLowerCase();
  if (!value) return null;
  return signatories.find((s) => value.includes(s.email.toLowerCase())) ?? null;
}

export function emailSignatureLines(signatory: EmailSignatory): string[] {
  const contact = [signatory.email, signatory.phone, signatory.license ? `Lic. ${signatory.license}` : null]
    .filter(Boolean)
    .join(" · ");
  return [
    signatory.name,
    signatory.title,
    FIRM_SIGNATURE.name,
    contact,
    FIRM_SIGNATURE.address,
    FIRM_SIGNATURE.website,
  ].filter(Boolean);
}

export function emailSignaturePlainText(signatory: EmailSignatory): string {
  return emailSignatureLines(signatory).join("\n");
}

export function stripEmailSignature(body: string): string {
  const idx = body.indexOf(EMAIL_SIGNATURE_FENCE);
  if (idx === -1) return body;
  return body.slice(0, idx);
}

export function emailSignatoryInBody(
  signatories: readonly EmailSignatory[],
  body: string
): EmailSignatory | null {
  const idx = body.indexOf(EMAIL_SIGNATURE_FENCE);
  if (idx === -1) return null;
  const rest = body.slice(idx + EMAIL_SIGNATURE_FENCE.length);
  return signatories.find((s) => rest.startsWith(s.name)) ?? null;
}

export function appendEmailSignature(
  body: string,
  signatory: EmailSignatory
): string {
  const message = stripEmailSignature(body).trimEnd();
  return `${message}${EMAIL_SIGNATURE_FENCE}${emailSignaturePlainText(signatory)}`;
}

/** Chosen sender wins, then a signature already in the body, then the From address, then the acting user. */
export function resolveOutboundSignatory(opts: {
  signatories: readonly EmailSignatory[];
  body: string;
  fromAddress: string;
  signatoryId?: EmailSignatoryId | null;
  fallbackId?: EmailSignatoryId | null;
}): EmailSignatory | null {
  return (
    emailSignatoryById(opts.signatories, opts.signatoryId) ??
    emailSignatoryInBody(opts.signatories, opts.body) ??
    emailSignatoryForAddress(opts.signatories, opts.fromAddress) ??
    emailSignatoryById(opts.signatories, opts.fallbackId)
  );
}
