"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type { DocType, PolicyLine } from "@prisma/client";
import {
  parsePolicyDocumentAction,
  updateClaimPolicyAction,
  deleteClaimPolicyAction,
  createManualClaimPolicyAction,
} from "@/lib/actions/claim-policies";
import {
  POLICY_LINE_LIMIT_TEMPLATES,
  type PolicyLimitRow,
} from "@/lib/policy-extraction";
import { POLICY_LINE_LABELS } from "@/lib/claims/labels";
import { DocumentUploadDialog } from "@/components/claims/document-upload-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PolicyDocSummary = {
  id: string;
  fileName: string;
  fileUrl: string;
  docType: DocType;
  uploadedAt: string;
  extractionStatus: string;
  policyLine: PolicyLine | null;
};

export type ClaimPolicySummary = {
  id: string;
  line: PolicyLine;
  label: string | null;
  policyNumber: string | null;
  carrierName: string | null;
  namedInsured: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  limits: PolicyLimitRow[];
  deductibleNotes: string | null;
  exclusions: string | null;
  endorsements: string | null;
  analysis: string | null;
  premium: string | null;
  documentId: string | null;
  parsedAt: string | null;
  isPrimary: boolean;
};

type LimitDraft = {
  key: string;
  label: string;
  amount: number | null;
  notes: string | null;
  amountStr: string;
};

type EditablePolicy = Omit<ClaimPolicySummary, "limits"> & {
  limits: LimitDraft[];
  premiumStr: string;
  effectiveStr: string;
  expirationStr: string;
};

type Props = {
  claimId: string;
  editable: boolean;
  policies: ClaimPolicySummary[];
  policyDocs: PolicyDocSummary[];
};

const LINE_OPTIONS = Object.entries(POLICY_LINE_LABELS) as Array<
  [PolicyLine, string]
>;

function toEditable(p: ClaimPolicySummary): EditablePolicy {
  const template = POLICY_LINE_LIMIT_TEMPLATES[p.line] ?? [];
  const merged: PolicyLimitRow[] =
    p.limits.length > 0
      ? p.limits
      : template.map((t) => ({
          key: t.key,
          label: t.label,
          amount: null,
          notes: null,
        }));

  return {
    ...p,
    limits: merged.map((l) => ({
      key: l.key,
      label: l.label,
      amount: l.amount,
      notes: l.notes ?? null,
      amountStr: l.amount != null ? String(l.amount) : "",
    })),
    premiumStr: p.premium ?? "",
    effectiveStr: p.effectiveDate ? p.effectiveDate.slice(0, 10) : "",
    expirationStr: p.expirationDate ? p.expirationDate.slice(0, 10) : "",
  };
}

export function PolicyCoveragePanel({
  claimId,
  editable,
  policies: initialPolicies,
  policyDocs,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [parseHint, setParseHint] = useState<PolicyLine | "AUTO">("AUTO");
  const [manualLine, setManualLine] = useState<PolicyLine>("HOMEOWNERS");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditablePolicy>>({});

  useEffect(() => {
    const next: Record<string, EditablePolicy> = {};
    for (const p of initialPolicies) {
      next[p.id] = toEditable(p);
    }
    setDrafts(next);
    setExpandedId((prev) => {
      if (prev && initialPolicies.some((p) => p.id === prev)) return prev;
      return initialPolicies[0]?.id ?? null;
    });
  }, [initialPolicies]);

  useEffect(() => {
    if (policyDocs.length > 0 && !selectedDocId) {
      setSelectedDocId(policyDocs[0].id);
    }
  }, [policyDocs, selectedDocId]);

  const ordered = useMemo(
    () =>
      [...initialPolicies].sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return (a.line + a.id).localeCompare(b.line + b.id);
      }),
    [initialPolicies]
  );

  function updateDraft(id: string, patch: Partial<EditablePolicy>) {
    setDrafts((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }

  function updateLimit(
    policyId: string,
    index: number,
    patch: Partial<EditablePolicy["limits"][0]>
  ) {
    setDrafts((prev) => {
      const cur = prev[policyId];
      if (!cur) return prev;
      const limits = cur.limits.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      );
      return { ...prev, [policyId]: { ...cur, limits } };
    });
  }

  async function parsePolicy(documentId?: string) {
    setError("");
    setParsing(true);
    const docId = documentId || selectedDocId || undefined;
    if (documentId) setSelectedDocId(documentId);
    try {
      const hint = parseHint === "AUTO" ? null : parseHint;
      const result = await parsePolicyDocumentAction(claimId, docId, hint);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.data.message);
      if (result.data.policyId) setExpandedId(result.data.policyId);
      router.refresh();
    } finally {
      setParsing(false);
    }
  }

  async function savePolicy(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setError("");
    setSavingId(id);
    try {
      const result = await updateClaimPolicyAction(claimId, {
        id,
        line: draft.line,
        label: draft.label,
        policyNumber: draft.policyNumber,
        carrierName: draft.carrierName,
        namedInsured: draft.namedInsured,
        effectiveDate: draft.effectiveStr || null,
        expirationDate: draft.expirationStr || null,
        deductibleNotes: draft.deductibleNotes,
        exclusions: draft.exclusions,
        endorsements: draft.endorsements,
        analysis: draft.analysis,
        premium: draft.premiumStr || null,
        isPrimary: draft.isPrimary,
        limits: draft.limits.map((row) => ({
          key: row.key,
          label: row.label,
          amount: row.amountStr.trim()
            ? Number(row.amountStr.replace(/,/g, ""))
            : null,
          notes: row.notes,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Policy coverage saved");
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  async function removePolicy(id: string) {
    if (!window.confirm("Remove this policy record from Coverage Protocol?")) {
      return;
    }
    setError("");
    const result = await deleteClaimPolicyAction(claimId, id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Policy record removed");
    router.refresh();
  }

  async function addManual() {
    setError("");
    setAdding(true);
    try {
      const result = await createManualClaimPolicyAction(claimId, manualLine);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Added ${POLICY_LINE_LABELS[manualLine]} slot`);
      setExpandedId(result.data.id);
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  function onLineChange(id: string, line: PolicyLine) {
    const draft = drafts[id];
    if (!draft) return;
    const template = POLICY_LINE_LIMIT_TEMPLATES[line] ?? [];
    const existing = new Map(draft.limits.map((l) => [l.key, l]));
    const limits: LimitDraft[] = template.map((t) => {
      const prev = existing.get(t.key);
      return {
        key: t.key,
        label: t.label,
        amount: prev?.amount ?? null,
        amountStr: prev?.amountStr ?? "",
        notes: prev?.notes ?? null,
      };
    });
    for (const row of draft.limits) {
      if (!template.some((t) => t.key === row.key)) {
        limits.push(row);
      }
    }
    updateDraft(id, {
      line,
      label: draft.label || POLICY_LINE_LABELS[line],
      limits,
    });
  }

  return (
    <section className="border border-brand-white/10 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Coverage Protocol</p>
          <p className="mt-1 text-sm text-brand-slate">
            Parse homeowners, condo master, CGL, umbrella, flood, and other
            product lines into separate policy records on this file.
          </p>
        </div>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setUploadOpen(true)}
            >
              Upload Policy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="solid"
              disabled={parsing || !selectedDocId}
              onClick={parsePolicy}
            >
              {parsing ? "Parsing…" : "Parse Policy"}
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <ErrorBanner
          message={error}
          onDismiss={() => setError("")}
          className="mb-4"
        />
      ) : null}

      <div className="mb-5 space-y-3 border border-brand-white/10 bg-brand-navy-deep/40 px-4 py-3">
        <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
          Policy documents on file
        </p>
        {policyDocs.length === 0 ? (
          <p className="text-sm text-brand-slate">
            No POLICY documents lodged. Use Upload Policy (document type must
            be Policy), then Parse Policy to extract coverage.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {policyDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-white"
              >
                <div className="min-w-0">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-gold hover:underline"
                  >
                    {doc.fileName}
                  </a>
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-brand-slate">
                    {doc.extractionStatus}
                    {doc.policyLine
                      ? ` · ${POLICY_LINE_LABELS[doc.policyLine]}`
                      : ""}
                  </span>
                </div>
                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={parsing}
                    onClick={() => void parsePolicy(doc.id)}
                  >
                    {parsing && selectedDocId === doc.id
                      ? "Parsing…"
                      : "Parse"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {editable && policyDocs.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <Label>Document to parse</Label>
              <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select document" />
                </SelectTrigger>
                <SelectContent>
                  {policyDocs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[10rem] space-y-1.5">
              <Label>Line hint</Label>
              <Select
                value={parseHint}
                onValueChange={(v) =>
                  setParseHint(v as PolicyLine | "AUTO")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Auto-detect</SelectItem>
                  {LINE_OPTIONS.map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>

      {editable ? (
        <div className="mb-5 flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] space-y-1.5">
            <Label>Add blank policy slot</Label>
            <Select
              value={manualLine}
              onValueChange={(v) => setManualLine(v as PolicyLine)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_OPTIONS.map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={adding}
            onClick={addManual}
          >
            {adding ? "Adding…" : "Add Manual Entry"}
          </Button>
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <p className="text-sm text-brand-slate">
          No coverage records yet. Upload and parse a policy, or add a manual
          entry for the product line you are working.
        </p>
      ) : (
        <div className="space-y-3">
          {ordered.map((p) => {
            const draft = drafts[p.id];
            if (!draft) return null;
            const open = expandedId === p.id;
            return (
              <div
                key={p.id}
                className="border border-brand-white/10 bg-brand-navy/30"
              >
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left"
                  onClick={() => setExpandedId(open ? null : p.id)}
                >
                  <div className="min-w-0">
                    <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
                      {POLICY_LINE_LABELS[draft.line]}
                      {draft.isPrimary ? " · Primary" : ""}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-brand-white">
                      {draft.label || draft.carrierName || "Untitled policy"}
                      {draft.policyNumber ? (
                        <span className="ml-2 font-mono text-xs text-brand-slate">
                          #{draft.policyNumber}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {draft.parsedAt ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-brand-slate">
                      Parsed{" "}
                      {format(new Date(draft.parsedAt), "yyyy-MM-dd HH:mm")}
                    </span>
                  ) : null}
                </button>

                {open ? (
                  <div className="space-y-4 border-t border-brand-white/10 px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Product line">
                        <Select
                          value={draft.line}
                          disabled={!editable}
                          onValueChange={(v) =>
                            onLineChange(p.id, v as PolicyLine)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LINE_OPTIONS.map(([k, label]) => (
                              <SelectItem key={k} value={k}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Label">
                        <Input
                          disabled={!editable}
                          value={draft.label ?? ""}
                          onChange={(e) =>
                            updateDraft(p.id, { label: e.target.value })
                          }
                          placeholder="e.g. Master Flood / Primary CGL"
                        />
                      </Field>
                      <Field label="Carrier">
                        <Input
                          disabled={!editable}
                          value={draft.carrierName ?? ""}
                          onChange={(e) =>
                            updateDraft(p.id, {
                              carrierName: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Policy number">
                        <Input
                          disabled={!editable}
                          value={draft.policyNumber ?? ""}
                          onChange={(e) =>
                            updateDraft(p.id, {
                              policyNumber: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Named insured">
                        <Input
                          disabled={!editable}
                          value={draft.namedInsured ?? ""}
                          onChange={(e) =>
                            updateDraft(p.id, {
                              namedInsured: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Premium">
                        <Input
                          disabled={!editable}
                          inputMode="decimal"
                          value={draft.premiumStr}
                          onChange={(e) =>
                            updateDraft(p.id, {
                              premiumStr: e.target.value,
                            })
                          }
                          placeholder="0.00"
                        />
                      </Field>
                      <Field label="Effective">
                        <Input
                          type="date"
                          disabled={!editable}
                          value={draft.effectiveStr}
                          onChange={(e) =>
                            updateDraft(p.id, {
                              effectiveStr: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Expiration">
                        <Input
                          type="date"
                          disabled={!editable}
                          value={draft.expirationStr}
                          onChange={(e) =>
                            updateDraft(p.id, {
                              expirationStr: e.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>

                    <div>
                      <p className="mb-2 font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                        Limits
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {draft.limits.map((row, i) => (
                          <Field key={`${row.key}-${i}`} label={row.label}>
                            <Input
                              disabled={!editable}
                              inputMode="decimal"
                              value={row.amountStr}
                              onChange={(e) =>
                                updateLimit(p.id, i, {
                                  amountStr: e.target.value,
                                })
                              }
                              placeholder="0.00"
                            />
                          </Field>
                        ))}
                      </div>
                    </div>

                    <Field label="Deductibles">
                      <Textarea
                        disabled={!editable}
                        rows={2}
                        value={draft.deductibleNotes ?? ""}
                        onChange={(e) =>
                          updateDraft(p.id, {
                            deductibleNotes: e.target.value,
                          })
                        }
                        placeholder="AOP, wind/hail, named storm, flood deductibles…"
                      />
                    </Field>
                    <Field label="Exclusions">
                      <Textarea
                        disabled={!editable}
                        rows={3}
                        value={draft.exclusions ?? ""}
                        onChange={(e) =>
                          updateDraft(p.id, { exclusions: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Endorsements / forms">
                      <Textarea
                        disabled={!editable}
                        rows={3}
                        value={draft.endorsements ?? ""}
                        onChange={(e) =>
                          updateDraft(p.id, {
                            endorsements: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Coverage analysis">
                      <Textarea
                        disabled={!editable}
                        rows={4}
                        value={draft.analysis ?? ""}
                        onChange={(e) =>
                          updateDraft(p.id, { analysis: e.target.value })
                        }
                        placeholder="How this layer applies to the loss…"
                      />
                    </Field>

                    {editable ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-brand-slate">
                          <input
                            type="checkbox"
                            checked={draft.isPrimary}
                            onChange={(e) =>
                              updateDraft(p.id, {
                                isPrimary: e.target.checked,
                              })
                            }
                            className="accent-brand-gold"
                          />
                          Primary policy on file
                        </label>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={savingId === p.id}
                          onClick={() => savePolicy(p.id)}
                        >
                          {savingId === p.id ? "Saving…" : "Save Policy"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removePolicy(p.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <DocumentUploadDialog
        claimId={claimId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultDocType="POLICY"
        showPolicyLineHint
      />
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
