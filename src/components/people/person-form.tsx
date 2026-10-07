"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { PersonRole, PreferredContactMethod } from "@prisma/client";
import {
  createPersonAction,
  linkPersonToClaimAction,
  updatePersonAction,
  type PossibleDuplicate,
} from "@/lib/actions/people";
import { CONTACT_METHOD_LABELS } from "@/lib/claims/labels";
import {
  LANGUAGE_OPTIONS,
  PERSON_ROLE_LABELS,
  PERSON_ROLES,
  TEMPERAMENT_GROUPS,
} from "@/lib/people/labels";
import type { CardFields } from "@/lib/people/card-parser";
import { ClaimField } from "@/components/claims/claim-field";
import { CardScanner, type CardScan } from "@/components/people/card-scanner";
import { ChipToggleGroup } from "@/components/people/person-chips";
import { EMPTY_PERSON, type PersonFormValues } from "@/components/people/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FIELD_LABELS: Record<keyof CardFields, string> = {
  name: "name",
  title: "title",
  company: "company",
  mobilePhone: "mobile",
  officePhone: "office phone",
  email: "email",
  website: "website",
  address: "address",
  role: "role",
  languages: "languages",
};

async function uploadCard(personId: string, image: Blob) {
  const form = new FormData();
  form.append("file", new File([image], "card.jpg", { type: "image/jpeg" }));
  const res = await fetch(`/api/people/${personId}/card`, { method: "POST", body: form });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Card photo upload failed.");
  }
}

export function PersonForm({
  personId,
  initial,
  claimId,
  onSaved,
  onCancel,
}: {
  /** Present when editing an existing directory entry */
  personId?: string;
  initial?: PersonFormValues;
  /** When adding from a claim, the new person is linked to this file */
  claimId?: string;
  onSaved: (id: string) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<PersonFormValues>(initial ?? EMPTY_PERSON);
  const [roleOnFile, setRoleOnFile] = useState("");
  const [scan, setScan] = useState<CardScan | null>(null);
  const [scanSummary, setScanSummary] = useState("");
  const [otherLanguage, setOtherLanguage] = useState("");
  const [duplicates, setDuplicates] = useState<PossibleDuplicate[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (scan) URL.revokeObjectURL(scan.previewUrl);
  }, [scan]);

  function set<K extends keyof PersonFormValues>(key: K, value: PersonFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function applyScan(result: CardScan) {
    const filled: string[] = [];
    const next = { ...values };
    for (const key of Object.keys(result.fields) as Array<keyof CardFields>) {
      const found = result.fields[key];
      if (!found || (Array.isArray(found) && !found.length)) continue;
      if (key === "languages") {
        const merged = Array.from(new Set([...next.languages, ...(found as string[])]));
        if (merged.length !== next.languages.length) filled.push(FIELD_LABELS[key]);
        next.languages = merged;
      } else if (key === "role") {
        if (next.role === "OTHER") {
          next.role = found as PersonRole;
          filled.push(FIELD_LABELS[key]);
        }
      } else if (!next[key].trim()) {
        next[key] = found as string;
        filled.push(FIELD_LABELS[key]);
      }
    }
    setValues(next);
    setScan(result);
    setScanSummary(
      filled.length
        ? `Filled ${filled.join(", ")} from the card. Check them before saving.`
        : "Nothing new to fill from the card. The photo will still be saved."
    );
  }

  async function finish(id: string) {
    if (scan) {
      try {
        await uploadCard(id, scan.image);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Card photo upload failed.");
      }
    }
    onSaved(id);
  }

  async function save(allowDuplicate = false) {
    setError("");
    setSaving(true);
    try {
      if (personId) {
        const result = await updatePersonAction(personId, values);
        if (!result.ok) return setError(result.error);
        toast.success("Profile updated");
        await finish(personId);
        return;
      }

      const result = await createPersonAction({
        ...values,
        claimId: claimId ?? null,
        roleOnFile: roleOnFile || null,
        allowDuplicate,
      });
      if (!result.ok) {
        setDuplicates(result.duplicates ?? []);
        if (!result.duplicates?.length) setError(result.error);
        return;
      }
      toast.success(claimId ? `${values.name} added to the file` : `${values.name} added to People`);
      await finish(result.data.id);
    } finally {
      setSaving(false);
    }
  }

  async function linkExisting(dup: PossibleDuplicate) {
    if (!claimId) return;
    setSaving(true);
    const result = await linkPersonToClaimAction({
      claimId,
      personId: dup.id,
      roleOnFile: roleOnFile || null,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    toast.success(`${dup.name} added to the file`);
    onSaved(dup.id);
  }

  function addOtherLanguage() {
    const lang = otherLanguage.trim();
    if (lang && !values.languages.includes(lang)) set("languages", [...values.languages, lang]);
    setOtherLanguage("");
  }

  const knownLanguages = new Set<string>(LANGUAGE_OPTIONS);
  const languageOptions = [
    ...LANGUAGE_OPTIONS,
    ...values.languages.filter((l) => !knownLanguages.has(l)),
  ];

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      <section className="flex flex-col gap-4 rounded-2xl border border-brand-gold/15 bg-brand-navy/40 p-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="eyebrow">Business card</p>
          <p className="text-sm text-brand-white/80">
            Take a photo and we&apos;ll fill in what we can read. The card is read on this
            device, and the photo is saved to the profile.
          </p>
          <CardScanner
            onScanned={applyScan}
            disabled={saving}
            label={scan ? "Rescan card" : "Scan business card"}
          />
          {scanSummary ? <p className="text-sm text-brand-gold">{scanSummary}</p> : null}
          {scan ? (
            <details className="text-xs text-brand-slate">
              <summary className="cursor-pointer select-none">What the scanner read</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-brand-white/10 bg-brand-navy/50 p-3 font-mono text-[11px] text-brand-white/80">
                {scan.text}
              </pre>
            </details>
          ) : null}
        </div>
        {scan ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scan.previewUrl}
            alt="Scanned business card"
            className="w-full max-w-[220px] rounded-xl border border-brand-white/10 object-cover sm:w-48"
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <p className="eyebrow">Who they are</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ClaimField label="Name *">
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} required />
          </ClaimField>
          <ClaimField label="Role">
            <Select value={values.role} onValueChange={(v) => set("role", v as PersonRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERSON_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {PERSON_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ClaimField>
          <ClaimField label="Title">
            <Input value={values.title} onChange={(e) => set("title", e.target.value)} />
          </ClaimField>
          <ClaimField label="Company">
            <Input value={values.company} onChange={(e) => set("company", e.target.value)} />
          </ClaimField>
          {claimId && !personId ? (
            <ClaimField label="Their part on this file" className="sm:col-span-2">
              <Input
                placeholder="e.g. Manager for Bayview Condo Association"
                value={roleOnFile}
                onChange={(e) => setRoleOnFile(e.target.value)}
              />
            </ClaimField>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <p className="eyebrow">How to reach them</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ClaimField label="Mobile">
            <Input
              type="tel"
              value={values.mobilePhone}
              onChange={(e) => set("mobilePhone", e.target.value)}
            />
          </ClaimField>
          <ClaimField label="Office">
            <Input
              type="tel"
              value={values.officePhone}
              onChange={(e) => set("officePhone", e.target.value)}
            />
          </ClaimField>
          <ClaimField label="Email">
            <Input
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </ClaimField>
          <ClaimField label="Website">
            <Input value={values.website} onChange={(e) => set("website", e.target.value)} />
          </ClaimField>
          <ClaimField label="Address" className="sm:col-span-2">
            <Input value={values.address} onChange={(e) => set("address", e.target.value)} />
          </ClaimField>
          <ClaimField label="Prefers">
            <Select
              value={values.preferredContactMethod ?? "none"}
              onValueChange={(v) =>
                set("preferredContactMethod", v === "none" ? null : (v as PreferredContactMethod))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No preference</SelectItem>
                {Object.entries(CONTACT_METHOD_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ClaimField>
          <ClaimField label="Best time to reach">
            <Input
              placeholder="e.g. Mornings before 10, never weekends"
              value={values.bestTimeToReach}
              onChange={(e) => set("bestTimeToReach", e.target.value)}
            />
          </ClaimField>
        </div>
      </section>

      <section className="space-y-3">
        <p className="eyebrow">Languages</p>
        <ChipToggleGroup
          options={languageOptions}
          selected={values.languages}
          onChange={(next) => set("languages", next)}
        />
        <div className="flex max-w-sm gap-2">
          <Input
            placeholder="Other language"
            value={otherLanguage}
            onChange={(e) => setOtherLanguage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOtherLanguage();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-10"
            onClick={addOtherLanguage}
          >
            Add
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <p className="eyebrow">Working with them</p>
        {TEMPERAMENT_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              {group.label}
            </p>
            <ChipToggleGroup
              options={group.options}
              selected={values.temperament}
              tone={group.tone}
              onChange={(next) => set("temperament", next)}
            />
          </div>
        ))}
        <ClaimField label="Notes">
          <Textarea
            rows={4}
            placeholder="What helps when working with them: decision makers, gate codes, who to copy, etc."
            value={values.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </ClaimField>
        <p className="text-xs text-brand-slate">
          Keep notes professional. They&apos;re part of the firm&apos;s records and can be
          requested in litigation.
        </p>
      </section>

      {duplicates.length ? (
        <section className="space-y-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/5 p-4">
          <p className="text-sm text-brand-white">
            This looks like someone already in People:
          </p>
          <ul className="space-y-2">
            {duplicates.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-brand-white">
                  {d.name}
                  {d.company ? <span className="text-brand-slate"> · {d.company}</span> : null}
                </span>
                <Link href={`/people/${d.id}`} target="_blank" className="text-brand-gold underline-offset-4 hover:underline">
                  View profile
                </Link>
                {claimId ? (
                  <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => linkExisting(d)}>
                    Add them to this file instead
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => save(true)}>
            Save as a new person anyway
          </Button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="solid" disabled={saving || !values.name.trim()}>
          {saving ? "Saving…" : personId ? "Save changes" : claimId ? "Add to file" : "Add person"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
