export const EMAIL_SIGNATURE_FENCE = "\n\n-- \n";

export const FIRM_SIGNATURE = {
  name: "Blackline Public Adjusters LLC",
  address: "100 Biscayne Boulevard, Suite 500, Miami, FL 33132",
  website: "blacklineadjusting.com",
} as const;

export type EmailSignatoryId = "miguel" | "rosie";

export type EmailSignatory = {
  id: EmailSignatoryId;
  name: string;
  title: string;
  email: string;
  phone: string;
  license: string | null;
};

export const EMAIL_SIGNATORIES: readonly EmailSignatory[] = [
  {
    id: "miguel",
    name: "Miguel A. Fernandez, M.Sc.",
    title: "Principal Adjuster and Founder",
    email: "miguel.fernandez@blacklineadjusting.com",
    phone: "(305) 555-0108",
    license: "W100001",
  },
  {
    id: "rosie",
    name: "Rosie Jetson",
    title: "Administrative Assistant",
    email: "rosie.jetson@blacklineadjusting.com",
    phone: "(305) 555-0142",
    license: null,
  },
];

export function emailSignatoryById(id: EmailSignatoryId): EmailSignatory {
  const found = EMAIL_SIGNATORIES.find((s) => s.id === id);
  if (!found) return EMAIL_SIGNATORIES[0];
  return found;
}

export function emailSignatoryForAddress(from: string): EmailSignatory | null {
  const value = from.trim().toLowerCase();
  if (!value) return null;
  const exact = EMAIL_SIGNATORIES.find((s) => value.includes(s.email));
  if (exact) return exact;
  if (value.includes("jetson") || value.includes("rosie")) {
    return emailSignatoryById("rosie");
  }
  if (value.includes("miguel") || value.includes("fernandez")) {
    return emailSignatoryById("miguel");
  }
  return null;
}

export function emailSignaturePlainText(signatory: EmailSignatory): string {
  const contact = [
    signatory.email,
    signatory.phone,
    signatory.license ? `Lic. ${signatory.license}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    signatory.name,
    signatory.title,
    FIRM_SIGNATURE.name,
    contact,
    FIRM_SIGNATURE.address,
    FIRM_SIGNATURE.website,
  ].join("\n");
}

export function stripEmailSignature(body: string): string {
  const idx = body.indexOf(EMAIL_SIGNATURE_FENCE);
  if (idx === -1) return body;
  return body.slice(0, idx);
}

export function emailSignatoryInBody(body: string): EmailSignatory | null {
  const idx = body.indexOf(EMAIL_SIGNATURE_FENCE);
  if (idx === -1) return null;
  const rest = body.slice(idx + EMAIL_SIGNATURE_FENCE.length);
  return EMAIL_SIGNATORIES.find((s) => rest.startsWith(s.name)) ?? null;
}

export function appendEmailSignature(
  body: string,
  signatory: EmailSignatory
): string {
  const message = stripEmailSignature(body).trimEnd();
  return `${message}${EMAIL_SIGNATURE_FENCE}${emailSignaturePlainText(signatory)}`;
}

/** Chosen sender wins, then a signature already in the body, then the From address. Outbound mail falls back to Miguel so a draft is never unsigned. */
export function resolveOutboundSignatory(opts: {
  body: string;
  fromAddress: string;
  signatoryId?: EmailSignatoryId | null;
}): EmailSignatory {
  if (opts.signatoryId) return emailSignatoryById(opts.signatoryId);
  return (
    emailSignatoryInBody(opts.body) ??
    emailSignatoryForAddress(opts.fromAddress) ??
    emailSignatoryById("miguel")
  );
}
