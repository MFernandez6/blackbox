"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import type { TaskStatus } from "@prisma/client";
import { TASK_STATUS_LABELS } from "@/lib/claims/labels";
import {
  createClaimTaskAction,
  updateClaimTaskAction,
  deleteClaimTaskAction,
} from "@/lib/actions/claim-workspace";
import type { ClaimWorkspaceProps } from "@/components/claims/claim-detail-types";
import { ClaimField } from "@/components/claims/claim-field";
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

export function TasksTab({ claim, adjusters, editable }: ClaimWorkspaceProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");

  async function createTask() {
    setError("");
    const result = await createClaimTaskAction({
      claimId: claim.id,
      title,
      description: description || null,
      dueDate: dueDate || null,
      assignedToId: assignedToId || null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Task created");
    setTitle("");
    setDescription("");
    setDueDate("");
    setAssignedToId("");
    router.refresh();
  }

  async function updateStatus(id: string, status: TaskStatus) {
    setError("");
    const result = await updateClaimTaskAction({ id, status });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Task updated");
    router.refresh();
  }

  async function removeTask(id: string) {
    if (!confirm("Delete this task?")) return;
    setError("");
    const result = await deleteClaimTaskAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Task deleted");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      <section className="border border-brand-white/10 p-4 sm:p-5">
        <p className="eyebrow mb-4">Tasks</p>
        {claim.tasks.length === 0 ? (
          <p className="mb-4 text-sm text-brand-slate">No tasks on file</p>
        ) : (
          <div className="mb-6 space-y-3">
            {claim.tasks.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-start justify-between gap-3 border border-brand-white/10 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-white">{t.title}</p>
                  {t.description ? (
                    <p className="mt-1 text-sm text-brand-slate">{t.description}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-xs text-brand-slate">
                    {t.dueDate
                      ? `Due ${format(new Date(t.dueDate), "yyyy-MM-dd")}`
                      : "No due date"}
                    {t.assignedToName ? ` · ${t.assignedToName}` : ""}
                    {` · ${t.createdByName}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    disabled={!editable}
                    value={t.status}
                    onValueChange={(v) => updateStatus(t.id, v as TaskStatus)}
                  >
                    <SelectTrigger className="w-full min-w-0 sm:w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TASK_STATUS_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editable ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeTask(t.id)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {editable ? (
          <div className="space-y-3 border-t border-brand-white/10 pt-4">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
              New Task
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ClaimField label="Title" className="sm:col-span-2">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </ClaimField>
              <ClaimField label="Description" className="sm:col-span-2">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="Due Date">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </ClaimField>
              <ClaimField label="Assigned To">
                <Select
                  value={assignedToId || "none"}
                  onValueChange={(v) =>
                    setAssignedToId(v === "none" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {adjusters.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClaimField>
            </div>
            <Button size="sm" variant="outline" onClick={createTask}>
              Create Task
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
