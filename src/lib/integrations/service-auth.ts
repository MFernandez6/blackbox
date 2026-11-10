import type { NextRequest } from "next/server";
import { bearerToken, matchesAnyKey } from "@/lib/security/safe-compare";

export function serviceKeyAuthorized(
  req: NextRequest | Request,
  keys: Array<string | undefined>
): boolean {
  return matchesAnyKey(bearerToken(req), keys.map((k) => k?.trim()));
}

export function blackgateServiceAuthorized(req: NextRequest | Request): boolean {
  return serviceKeyAuthorized(req, [
    process.env.BLACKBOX_API_KEY,
    process.env.BLACKGATE_API_KEY,
  ]);
}
