"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Mail, Phone, Plus } from "lucide-react";
import { LANGUAGE_OPTIONS, PERSON_ROLE_LABELS, PERSON_ROLES } from "@/lib/people/labels";
import { LanguageChips, RoleBadge, TemperamentChips } from "@/components/people/person-chips";
import type { PersonSummary } from "@/components/people/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type PeopleRow = PersonSummary & { fileCount: number };

export function PeopleDirectoryClient({
  people,
  total,
  canAdd,
}: {
  people: PeopleRow[];
  total: number;
  canAdd: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setParam("q", value.trim() || null), 300);
  }

  const filtered = Boolean(searchParams.get("q") || searchParams.get("role") || searchParams.get("lang"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Directory</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold tracking-[0.06em] text-brand-white">
            People
          </h1>
          <p className="mt-1 text-sm text-brand-slate">
            Property managers, adjusters, contractors and everyone else we work with.
          </p>
        </div>
        {canAdd ? (
          <Button asChild variant="solid" className="gap-2">
            <Link href="/people/new">
              <Plus className="h-3.5 w-3.5" />
              Add person
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-2xl border border-brand-gold/15 bg-brand-navy/40 p-4 sm:grid-cols-[1fr_220px_180px]">
        <Input
          placeholder="Search name, company, email or phone"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <Select value={searchParams.get("role") ?? "all"} onValueChange={(v) => setParam("role", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {PERSON_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {PERSON_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={searchParams.get("lang") ?? "all"} onValueChange={(v) => setParam("lang", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any language</SelectItem>
            {LANGUAGE_OPTIONS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-brand-slate">
        {filtered ? `${people.length} of ${total}` : `${total}`} {total === 1 ? "person" : "people"}
      </p>

      {people.length === 0 ? (
        <div className="rounded-2xl border border-brand-gold/15 p-8 text-center">
          <p className="text-sm text-brand-white/80">
            {filtered ? "No one matches those filters." : "No one in the directory yet."}
          </p>
          {canAdd && !filtered ? (
            <p className="mt-2 text-sm text-brand-slate">
              Add someone by hand, or scan their business card from your phone.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className={cn("grid gap-3 md:grid-cols-2", pending && "opacity-60")}>
          {people.map((p) => {
            const phone = p.mobilePhone ?? p.officePhone;
            return (
              <li
                key={p.id}
                className="group relative flex flex-col gap-3 rounded-2xl border border-brand-gold/15 bg-brand-navy/40 p-4 transition-colors hover:border-brand-gold/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/people/${p.id}`}
                      className="font-serif text-lg tracking-wide text-brand-white after:absolute after:inset-0 group-hover:text-brand-gold"
                    >
                      {p.name}
                    </Link>
                    <p className="truncate text-sm text-brand-slate">
                      {[p.title, p.company].filter(Boolean).join(" · ") || "\u00a0"}
                    </p>
                  </div>
                  <RoleBadge role={p.role} className="shrink-0" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {phone ? (
                    <a href={`tel:${phone}`} className="relative z-10 inline-flex items-center gap-1.5 text-brand-white/85 hover:text-brand-gold">
                      <Phone className="h-3.5 w-3.5" />
                      {phone}
                    </a>
                  ) : null}
                  {p.email ? (
                    <a href={`mailto:${p.email}`} className="relative z-10 inline-flex min-w-0 items-center gap-1.5 text-brand-white/85 hover:text-brand-gold">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </a>
                  ) : null}
                  <span className="ml-auto font-mono text-xs text-brand-slate">
                    {p.fileCount} {p.fileCount === 1 ? "file" : "files"}
                  </span>
                </div>
                <LanguageChips languages={p.languages} />
                <TemperamentChips tags={p.temperament} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
