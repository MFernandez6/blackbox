"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import type { ClaimStatus } from "@prisma/client";
import { Globe, Mail, MapPin, Phone, Smartphone } from "lucide-react";
import { deletePersonAction } from "@/lib/actions/people";
import { CONTACT_METHOD_LABELS } from "@/lib/claims/labels";
import { StatusBadge } from "@/components/claims/status-badge";
import { LanguageChips, RoleBadge, TemperamentChips } from "@/components/people/person-chips";
import { PersonForm } from "@/components/people/person-form";
import { toFormValues, type PersonDetail } from "@/components/people/types";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";

export type PersonFileLink = {
  linkId: string;
  claimId: string;
  claimNumber: string;
  propertyAddress: string;
  status: ClaimStatus;
  isArchived: boolean;
  roleOnFile: string | null;
};

function websiteHref(site: string) {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export function PersonProfileClient({
  person,
  files,
  hiddenFileCount,
  canEdit,
  canDelete,
}: {
  person: PersonDetail;
  files: PersonFileLink[];
  hiddenFileCount: number;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    const linked = files.length + hiddenFileCount;
    const warning = linked
      ? `Delete ${person.name}? They'll be removed from ${linked} ${linked === 1 ? "file" : "files"}. This can't be undone.`
      : `Delete ${person.name}? This can't be undone.`;
    if (!confirm(warning)) return;
    const result = await deletePersonAction(person.id);
    if (!result.ok) return setError(result.error);
    toast.success(`${person.name} deleted`);
    router.push("/people");
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <button type="button" onClick={() => setEditing(false)} className="eyebrow hover:text-brand-gold">
            ← Back to profile
          </button>
          <h1 className="mt-2 font-serif text-2xl font-semibold tracking-[0.06em] text-brand-white">
            Edit {person.name}
          </h1>
        </div>
        <PersonForm
          personId={person.id}
          initial={toFormValues(person)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const reach = [
    person.mobilePhone && { icon: Smartphone, label: "Mobile", value: person.mobilePhone, href: `tel:${person.mobilePhone}` },
    person.officePhone && { icon: Phone, label: "Office", value: person.officePhone, href: `tel:${person.officePhone}` },
    person.email && { icon: Mail, label: "Email", value: person.email, href: `mailto:${person.email}` },
    person.website && { icon: Globe, label: "Website", value: person.website, href: websiteHref(person.website) },
    person.address && {
      icon: MapPin,
      label: "Address",
      value: person.address,
      href: `https://maps.google.com/?q=${encodeURIComponent(person.address)}`,
    },
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; value: string; href: string }>;

  return (
    <div className="space-y-6">
      <Link href="/people" className="eyebrow hover:text-brand-gold">
        ← People
      </Link>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <RoleBadge role={person.role} />
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[0.04em] text-brand-white">
            {person.name}
          </h1>
          {person.title || person.company ? (
            <p className="mt-1 text-brand-slate">
              {[person.title, person.company].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div className="flex gap-2">
            <Button variant="solid" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {canDelete ? (
              <Button variant="destructive" onClick={remove}>
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="panel space-y-4 p-4 sm:p-5">
            <p className="eyebrow">How to reach them</p>
            {reach.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {reach.map((r) => (
                  <li key={r.label} className={r.label === "Address" ? "sm:col-span-2" : undefined}>
                    <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                      {r.label}
                    </p>
                    <a
                      href={r.href}
                      target={r.href.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                      className="mt-1 inline-flex items-start gap-2 break-all text-brand-white hover:text-brand-gold"
                    >
                      <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                      {r.value}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-slate">No contact details yet.</p>
            )}
            {person.preferredContactMethod || person.bestTimeToReach ? (
              <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-brand-white/10 pt-4 text-sm">
                {person.preferredContactMethod ? (
                  <p>
                    <span className="text-brand-slate">Prefers </span>
                    <span className="text-brand-white">
                      {CONTACT_METHOD_LABELS[person.preferredContactMethod].toLowerCase()}
                    </span>
                  </p>
                ) : null}
                {person.bestTimeToReach ? (
                  <p>
                    <span className="text-brand-slate">Best time: </span>
                    <span className="text-brand-white">{person.bestTimeToReach}</span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="panel space-y-4 p-4 sm:p-5">
            <p className="eyebrow">Working with them</p>
            {person.languages.length ? (
              <div className="space-y-2">
                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Languages
                </p>
                <LanguageChips languages={person.languages} />
              </div>
            ) : null}
            {person.temperament.length ? (
              <div className="space-y-2">
                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Temperament
                </p>
                <TemperamentChips tags={person.temperament} />
              </div>
            ) : null}
            {person.notes ? (
              <div className="space-y-2">
                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-white/90">
                  {person.notes}
                </p>
              </div>
            ) : null}
            {!person.languages.length && !person.temperament.length && !person.notes ? (
              <p className="text-sm text-brand-slate">
                Nothing yet. Add languages, temperament and notes so the next adjuster knows what to expect.
              </p>
            ) : null}
          </section>

          <section className="panel space-y-3 p-4 sm:p-5">
            <p className="eyebrow">Files</p>
            {files.length ? (
              <ul className="divide-y divide-brand-white/10">
                {files.map((f) => (
                  <li key={f.linkId} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link
                        href={`/claims/${f.claimId}?tab=contacts`}
                        className="font-mono text-sm text-brand-gold hover:underline"
                      >
                        {f.claimNumber}
                      </Link>
                      <p className="truncate text-sm text-brand-white/85">{f.propertyAddress}</p>
                      {f.roleOnFile ? <p className="text-xs text-brand-slate">{f.roleOnFile}</p> : null}
                    </div>
                    <StatusBadge status={f.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-slate">
                {hiddenFileCount ? "" : "Not on any files yet. Add them from a claim's Contacts tab."}
              </p>
            )}
            {hiddenFileCount ? (
              <p className="text-xs text-brand-slate">
                Also on {hiddenFileCount} {hiddenFileCount === 1 ? "file" : "files"} assigned to other adjusters.
              </p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="panel space-y-3 p-4">
            <p className="eyebrow">Business card</p>
            {person.hasCard ? (
              <a href={`/api/people/${person.id}/card?v=${encodeURIComponent(person.updatedAt)}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/people/${person.id}/card?v=${encodeURIComponent(person.updatedAt)}`}
                  alt={`${person.name}'s business card`}
                  className="w-full rounded-xl border border-brand-white/10"
                />
              </a>
            ) : (
              <p className="text-sm text-brand-slate">
                No card on file.{canEdit ? " Choose Edit to scan one." : ""}
              </p>
            )}
          </section>
          <p className="px-1 text-xs leading-relaxed text-brand-slate">
            Added by {person.createdByName} on {format(new Date(person.createdAt), "MMM d, yyyy")}
            {person.updatedByName &&
            new Date(person.updatedAt).getTime() - new Date(person.createdAt).getTime() > 60_000
              ? ` · Last edited by ${person.updatedByName} on ${format(new Date(person.updatedAt), "MMM d, yyyy")}`
              : ""}
          </p>
        </aside>
      </div>
    </div>
  );
}
