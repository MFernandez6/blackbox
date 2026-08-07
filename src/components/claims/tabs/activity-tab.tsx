"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { STATUS_LABELS } from "@/lib/claims/labels";
import {
  createClaimNoteAction,
  deleteClaimNoteAction,
} from "@/lib/actions/claim-workspace";
import type { ClaimWorkspaceProps } from "@/components/claims/claim-detail-types";
import { ClaimField } from "@/components/claims/claim-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/ui/error-banner";

export function ActivityTab({ claim, editable }: ClaimWorkspaceProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [noteBody, setNoteBody] = useState("");

  async function addNote() {
    setError("");
    const result = await createClaimNoteAction({
      claimId: claim.id,
      body: noteBody,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Note added");
    setNoteBody("");
    router.refresh();
  }

  async function removeNote(id: string) {
    if (!confirm("Delete this note?")) return;
    setError("");
    const result = await deleteClaimNoteAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Note deleted");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="border border-brand-white/10 p-4 sm:p-5">
          <p className="eyebrow mb-4">Notes</p>
          {claim.notes.length === 0 ? (
            <p className="mb-4 text-sm text-brand-slate">No notes on file</p>
          ) : (
            <ol className="mb-6 space-y-4">
              {claim.notes.map((n) => (
                <li
                  key={n.id}
                  className="border border-brand-white/10 p-3"
                >
                  <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                    {format(new Date(n.createdAt), "yyyy-MM-dd HH:mm")} ·{" "}
                    {n.createdByName}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-brand-white">
                    {n.body}
                  </p>
                  {editable ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeNote(n.id)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          )}

          {editable ? (
            <div className="space-y-3 border-t border-brand-white/10 pt-4">
              <ClaimField label="New Note">
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Record observation or update"
                />
              </ClaimField>
              <Button size="sm" variant="outline" onClick={addNote}>
                Add Note
              </Button>
            </div>
          ) : null}
        </section>

        <section className="border border-brand-white/10 p-4 sm:p-5">
          <p className="eyebrow mb-4">History</p>
          <p className="mb-4 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
            Chain of custody: unbroken
          </p>
          <ol className="space-y-0">
            {claim.auditEvents.map((e) => (
              <li
                key={e.id}
                className="relative border-l border-brand-white/10 pb-6 pl-4 last:pb-0"
              >
                <span className="absolute -left-[3px] top-1 h-1.5 w-1.5 bg-brand-gold" />
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  {format(new Date(e.createdAt), "yyyy-MM-dd HH:mm")} · Audit
                </p>
                <p className="mt-1 text-sm text-brand-white">{e.summary}</p>
                <p className="text-xs text-brand-slate">
                  {e.actorName} · {e.action}
                </p>
              </li>
            ))}
            {claim.statusHistory.map((h) => (
              <li
                key={h.id}
                className="relative border-l border-brand-white/10 pb-6 pl-4 last:pb-0"
              >
                <span className="absolute -left-[3px] top-1 h-1.5 w-1.5 bg-brand-gold" />
                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                  {format(new Date(h.changedAt), "yyyy-MM-dd HH:mm")} · Status
                </p>
                <p className="mt-1 text-sm text-brand-white">
                  {h.previousStatus
                    ? `${STATUS_LABELS[h.previousStatus]} → ${STATUS_LABELS[h.newStatus]}`
                    : STATUS_LABELS[h.newStatus]}
                </p>
                <p className="text-xs text-brand-slate">{h.changedByName}</p>
                {h.note ? (
                  <p className="mt-1 text-sm text-brand-white/80">{h.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
