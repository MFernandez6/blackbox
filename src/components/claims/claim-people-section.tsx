"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Phone, Plus, Search } from "lucide-react";
import {
  linkPersonToClaimAction,
  searchPeopleAction,
  unlinkPersonFromClaimAction,
  type PersonSearchResult,
} from "@/lib/actions/people";
import { CONTACT_METHOD_LABELS } from "@/lib/claims/labels";
import { PERSON_ROLE_LABELS } from "@/lib/people/labels";
import type { ClaimDetailData } from "@/components/claims/claim-detail-types";
import { LanguageChips, RoleBadge, TemperamentChips } from "@/components/people/person-chips";
import { PersonForm } from "@/components/people/person-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ClaimPeopleSection({
  claimId,
  people,
  editable,
}: {
  claimId: string;
  people: ClaimDetailData["people"];
  editable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [roleOnFile, setRoleOnFile] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const linkedIds = new Set(people.map((p) => p.id));

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const result = await searchPeopleAction(value);
      setSearching(false);
      if (result.ok) setResults(result.data);
    }, 250);
  }

  async function link(person: PersonSearchResult) {
    setError("");
    setBusyId(person.id);
    const result = await linkPersonToClaimAction({
      claimId,
      personId: person.id,
      roleOnFile: roleOnFile || null,
    });
    setBusyId(null);
    if (!result.ok) return setError(result.error);
    toast.success(`${person.name} added to the file`);
    setQuery("");
    setResults([]);
    setRoleOnFile("");
    router.refresh();
  }

  async function unlink(linkId: string, name: string) {
    if (!confirm(`Remove ${name} from this file? They stay in the People directory.`)) return;
    setError("");
    setBusyId(linkId);
    const result = await unlinkPersonFromClaimAction(linkId);
    setBusyId(null);
    if (!result.ok) return setError(result.error);
    toast.success(`${name} removed from the file`);
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">People on this file</p>
          <p className="mt-1 text-xs text-brand-slate">
            Property managers, contractors, PAs, carrier adjusters and other parties, from the{" "}
            <Link href="/people" className="text-brand-gold hover:underline">
              People directory
            </Link>
            .
          </p>
        </div>
        {editable ? (
          <Button size="sm" variant="solid" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="h-3 w-3" />
            New person
          </Button>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      {people.length === 0 ? (
        <p className="text-sm text-brand-slate">No one linked to this file yet.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {people.map((p) => {
            const phone = p.mobilePhone ?? p.officePhone;
            return (
              <li key={p.linkId} className="flex flex-col gap-3 rounded-2xl border border-brand-gold/15 bg-brand-navy/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/people/${p.id}`}
                      className="font-serif text-base tracking-wide text-brand-white hover:text-brand-gold"
                    >
                      {p.name}
                    </Link>
                    <p className="truncate text-sm text-brand-slate">
                      {[p.title, p.company].filter(Boolean).join(" · ") || PERSON_ROLE_LABELS[p.role]}
                    </p>
                    {p.roleOnFile ? (
                      <p className="mt-1 text-xs text-brand-white/75">{p.roleOnFile}</p>
                    ) : null}
                  </div>
                  <RoleBadge role={p.role} className="shrink-0" />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {phone ? (
                    <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-brand-white/85 hover:text-brand-gold">
                      <Phone className="h-3.5 w-3.5" />
                      {phone}
                    </a>
                  ) : null}
                  {p.email ? (
                    <a href={`mailto:${p.email}`} className="inline-flex min-w-0 items-center gap-1.5 text-brand-white/85 hover:text-brand-gold">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </a>
                  ) : null}
                  {p.preferredContactMethod ? (
                    <span className="text-xs leading-5 text-brand-slate">
                      Prefers {CONTACT_METHOD_LABELS[p.preferredContactMethod].toLowerCase()}
                    </span>
                  ) : null}
                </div>
                <LanguageChips languages={p.languages} />
                <TemperamentChips tags={p.temperament} />
                {editable ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start px-0"
                    disabled={busyId === p.linkId}
                    onClick={() => unlink(p.linkId, p.name)}
                  >
                    Remove from file
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {editable ? (
        <div className="space-y-3 border-t border-brand-white/10 pt-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
            Add someone from the directory
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-slate" />
              <Input
                className="pl-9"
                placeholder="Search name, company, email or phone"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </div>
            <Input
              placeholder="Their part on this file (optional)"
              value={roleOnFile}
              onChange={(e) => setRoleOnFile(e.target.value)}
            />
          </div>
          {query.trim().length >= 2 ? (
            searching ? (
              <p className="text-sm text-brand-slate">Searching…</p>
            ) : results.length ? (
              <ul className="divide-y divide-brand-white/10 rounded-2xl border border-brand-white/10">
                {results.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-brand-white">{r.name}</p>
                      <p className="truncate text-xs text-brand-slate">
                        {[PERSON_ROLE_LABELS[r.role], r.company, r.mobilePhone ?? r.officePhone ?? r.email]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {linkedIds.has(r.id) ? (
                      <span className="text-xs text-brand-slate">On this file</span>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => link(r)}>
                        Add to file
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-slate">
                No match in the directory.{" "}
                <button type="button" className="text-brand-gold hover:underline" onClick={() => setCreating(true)}>
                  Add them as a new person
                </button>
              </p>
            )
          ) : null}
        </div>
      ) : null}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New person on this file</DialogTitle>
            <DialogDescription>
              They&apos;ll be saved to the People directory and linked to this file.
            </DialogDescription>
          </DialogHeader>
          {creating ? (
            <PersonForm
              claimId={claimId}
              onSaved={() => {
                setCreating(false);
                router.refresh();
              }}
              onCancel={() => setCreating(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
