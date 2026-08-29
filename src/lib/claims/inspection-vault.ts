/** Group BLACKMIRROR field photos inside the BLACKBOX document vault. */

export type VaultDocLike = {
  fileName: string;
  fileUrl: string;
  displayPath?: string | null;
};

function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sessionLabel(slug: string) {
  const [date, ...rest] = slug.split("_");
  const reason = titleCase(rest.join(" ").replace(/-/g, " "));
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && reason) return `${date} · ${reason}`;
  return titleCase(slug.replace(/[_-]+/g, " "));
}

export function isInspectionVaultDoc(
  doc: VaultDocLike,
  claimNumber: string
): boolean {
  if (doc.displayPath && doc.displayPath.trim()) return true;
  return doc.fileUrl.includes(`/claims/${claimNumber}/`);
}

export function inspectionFolder(
  doc: VaultDocLike,
  claimNumber: string
): { sessionKey: string; sessionLabel: string; locationKey: string; locationLabel: string } {
  const fromPath = doc.displayPath
    ?.split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (fromPath && fromPath.length >= 4) {
    const session = fromPath[2] ?? "inspection";
    const location = fromPath[3] ?? "unspecified";
    return {
      sessionKey: session,
      sessionLabel: sessionLabel(session),
      locationKey: location,
      locationLabel: titleCase(location.replace(/-/g, " ")),
    };
  }

  const marker = `/claims/${claimNumber}/`;
  const idx = doc.fileUrl.indexOf(marker);
  if (idx >= 0) {
    const rest = doc.fileUrl.slice(idx + marker.length).split("?")[0];
    const [session = "inspection", location = "unspecified"] = rest.split("/");
    return {
      sessionKey: session,
      sessionLabel: sessionLabel(session),
      locationKey: location,
      locationLabel: titleCase(location.replace(/-/g, " ")),
    };
  }

  return {
    sessionKey: "inspection",
    sessionLabel: "Field inspection",
    locationKey: "unspecified",
    locationLabel: "Unspecified",
  };
}

export function groupInspectionDocs<T extends VaultDocLike>(
  docs: T[],
  claimNumber: string
): Array<{
  key: string;
  label: string;
  locations: Array<{ key: string; label: string; docs: T[] }>;
}> {
  const sessions = new Map<
    string,
    { label: string; locations: Map<string, { label: string; docs: T[] }> }
  >();

  for (const doc of docs) {
    const folder = inspectionFolder(doc, claimNumber);
    const session =
      sessions.get(folder.sessionKey) ??
      ({
        label: folder.sessionLabel,
        locations: new Map(),
      } satisfies { label: string; locations: Map<string, { label: string; docs: T[] }> });
    const location =
      session.locations.get(folder.locationKey) ??
      ({ label: folder.locationLabel, docs: [] } satisfies {
        label: string;
        docs: T[];
      });
    location.docs.push(doc);
    session.locations.set(folder.locationKey, location);
    sessions.set(folder.sessionKey, session);
  }

  return Array.from(sessions.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, session]) => ({
      key,
      label: session.label,
      locations: Array.from(session.locations.entries()).map(([locKey, loc]) => ({
        key: locKey,
        label: loc.label,
        docs: loc.docs,
      })),
    }));
}
