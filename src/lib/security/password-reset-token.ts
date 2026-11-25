import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 30 * 60 * 1000;

type ResetPayload = {
  email: string;
  sv: number;
  exp: number;
};

function secret() {
  const value = process.env.NEXTAUTH_SECRET?.trim();
  if (!value) throw new Error("NEXTAUTH_SECRET is not set");
  return value;
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Signed, 30-minute reset token. It dies when the account's session version changes. */
export function createPasswordResetToken(email: string, sessionVersion: number) {
  const body = Buffer.from(
    JSON.stringify({
      email: email.toLowerCase(),
      sv: sessionVersion,
      exp: Date.now() + TTL_MS,
    } satisfies ResetPayload)
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readPasswordResetToken(token: string): { email: string; sv: number } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || token.split(".").length !== 2) return null;
  const expected = sign(body);
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) return null;
  let payload: ResetPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString()) as ResetPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.email !== "string" ||
    typeof payload.sv !== "number" ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    return null;
  }
  return { email: payload.email.toLowerCase(), sv: payload.sv };
}
