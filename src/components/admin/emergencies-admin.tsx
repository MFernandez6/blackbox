"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveEmergencyDeclarationAction } from "@/lib/actions/compliance";
import { addDays, EMERGENCY_WINDOW_DAYS } from "@/lib/compliance/florida-pa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";

type Declaration = {
  id: string;
  name: string;
  executiveOrder: string | null;
  declaredDate: string;
  counties: string | null;
  notes: string | null;
  isActive: boolean;
  claimCount: number;
};

type Draft = Omit<Declaration, "id" | "claimCount">;

const EMPTY: Draft = {
  name: "",
  executiveOrder: "",
  declaredDate: "",
  counties: "",
  notes: "",
  isActive: true,
};

function windowEnd(date: string) {
  return date ? addDays(new Date(`${date}T00:00:00Z`), EMERGENCY_WINDOW_DAYS).toISOString().slice(0, 10) : "";
}

export function EmergenciesAdmin({ declarations }: { declarations: Declaration[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result = await saveEmergencyDeclarationAction(editingId, draft);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    toast.success(editingId ? "Declaration updated · linked files recalculated" : "Declaration added");
    setEditingId(null);
    setDraft(EMPTY);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Admin · Compliance</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold tracking-[0.06em] text-brand-white">
          Emergency declarations
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-slate">
          Governor-declared states of emergency. Linking a file to a declaration applies the 10% fee cap when the
          claim was reported to the insurer within one year of the declaration (Fla. Stat. § 626.854(11)). Enter
          the date from the executive order.
        </p>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}

      <form onSubmit={save} className="grid gap-3 rounded-2xl border border-brand-gold/15 p-4 sm:grid-cols-2 sm:p-5">
        <p className="eyebrow sm:col-span-2">{editingId ? "Edit declaration" : "Add declaration"}</p>
        <div className="space-y-2">
          <Label htmlFor="e-name">Event</Label>
          <Input
            id="e-name"
            value={draft.name}
            placeholder="Hurricane Milton"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="e-eo">Executive order #</Label>
          <Input
            id="e-eo"
            value={draft.executiveOrder ?? ""}
            placeholder="24-214"
            onChange={(e) => setDraft({ ...draft, executiveOrder: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="e-date">Declared</Label>
          <Input
            id="e-date"
            type="date"
            value={draft.declaredDate}
            onChange={(e) => setDraft({ ...draft, declaredDate: e.target.value })}
          />
          {draft.declaredDate ? (
            <p className="text-xs text-brand-slate">10% window for claims reported through {windowEnd(draft.declaredDate)}</p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 self-center text-sm">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
          />
          Offer on new files
        </label>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="e-counties">Counties</Label>
          <Textarea
            id="e-counties"
            value={draft.counties ?? ""}
            onChange={(e) => setDraft({ ...draft, counties: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="e-notes">Notes</Label>
          <Textarea id="e-notes" value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" size="sm" variant="outline" disabled={busy || !draft.name || !draft.declaredDate}>
            {editingId ? "Save changes" : "Add declaration"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <ul className="space-y-3">
        {declarations.map((d) => (
          <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-brand-gold/15 p-4">
            <div className="min-w-0">
              <p className="font-semibold">
                {d.name}
                {d.executiveOrder ? <span className="text-brand-slate"> · EO {d.executiveOrder}</span> : null}
                {!d.isActive ? <span className="ml-2 text-xs text-brand-slate">(hidden on new files)</span> : null}
              </p>
              <p className="text-sm text-brand-slate">
                Declared {d.declaredDate} · 10% window through {windowEnd(d.declaredDate)} · {d.claimCount} file
                {d.claimCount === 1 ? "" : "s"}
              </p>
              {d.counties ? <p className="mt-1 text-xs text-brand-slate">{d.counties}</p> : null}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingId(d.id);
                setDraft({
                  name: d.name,
                  executiveOrder: d.executiveOrder ?? "",
                  declaredDate: d.declaredDate,
                  counties: d.counties ?? "",
                  notes: d.notes ?? "",
                  isActive: d.isActive,
                });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Edit
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
