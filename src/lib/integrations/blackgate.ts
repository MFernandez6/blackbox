export function blackgateAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BLACKGATE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const api = process.env.BLACKGATE_API_URL?.replace(/\/$/, "");
  return api ?? "http://localhost:3002";
}

export function resolveBlackgateFileUrl(fileUrl: string): string {
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  const base = blackgateAppUrl();
  if (fileUrl.startsWith("/")) return `${base}${fileUrl}`;
  return `${base}/${fileUrl}`;
}
