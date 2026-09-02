import type { NextRequest } from "next/server";

function bearerToken(req: NextRequest | Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
}

export function serviceKeyAuthorized(
  req: NextRequest | Request,
  keys: Array<string | undefined>
): boolean {
  const token = bearerToken(req);
  if (!token) return false;
  return keys.some((key) => !!key && key === token);
}

export function blackgateServiceAuthorized(req: NextRequest | Request): boolean {
  return serviceKeyAuthorized(req, [
    process.env.BLACKBOX_API_KEY,
    process.env.BLACKGATE_API_KEY,
  ]);
}
