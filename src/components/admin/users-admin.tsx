"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createUserAction,
  resetUserMfaAction,
  resetUserPasswordAction,
  revokeUserSessionsAction,
  unlockUserAction,
  updateUserAction,
} from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Role = "ADMIN" | "ADJUSTER" | "VIEWER";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  licenseNumber: string;
  title: string;
  phone: string;
  isActive: boolean;
  isLocked: boolean;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

const ROLES: Role[] = ["ADMIN", "ADJUSTER", "VIEWER"];

function TempPassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return (
    <div className="rounded-2xl border border-brand-gold/40 bg-brand-gold/5 p-4">
      <p className="eyebrow">Temporary password · shown once</p>
      <p className="mt-2 text-sm">
        Give this to {email} through a separate channel (phone or in person, not the same email thread). They
        must change it at first sign-in.
      </p>
      <p className="mt-3 select-all break-all rounded-md bg-brand-navy-deep/60 px-3 py-2 font-mono text-base">
        {password}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(password);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

export function UsersAdmin({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", licenseNumber: "", title: "", phone: "", role: "ADJUSTER" as Role });
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result = await createUserAction(form);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setIssued({ email: form.email, password: result.data.temporaryPassword });
    setForm({ name: "", email: "", licenseNumber: "", title: "", phone: "", role: "ADJUSTER" });
    router.refresh();
  }

  async function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    const result = await fn();
    if (!result.ok) return setError(result.error ?? "Action failed.");
    toast.success(label);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Admin</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold tracking-[0.06em] text-brand-white">Users</h1>
        <p className="mt-2 text-sm text-brand-slate">
          One account signs into every BLACKSUITE app. Deactivating a user or changing their role signs them out
          everywhere.
        </p>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} /> : null}
      {issued ? <TempPassword {...issued} onClose={() => setIssued(null)} /> : null}

      <section className="rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
        <p className="eyebrow mb-4">Invite a user</p>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="u-name">Full name</Label>
            <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-email">Email</Label>
            <Input
              id="u-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="u-license">DFS license #</Label>
            <Input
              id="u-license"
              value={form.licenseNumber}
              onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
              placeholder="e.g. G123456"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={busy || !form.name || !form.email}>
            Create user
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        {users.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            isSelf={u.id === currentUserId}
            onSave={(patch) => run("User updated", () => updateUserAction(u.id, patch))}
            onReset={async () => {
              if (!confirm(`Reset the password for ${u.email}? They will be signed out everywhere.`)) return;
              setError("");
              const result = await resetUserPasswordAction(u.id);
              if (!result.ok) return setError(result.error);
              setIssued({ email: u.email, password: result.data.temporaryPassword });
              router.refresh();
            }}
            onUnlock={() => run("Account unlocked", () => unlockUserAction(u.id))}
            onResetMfa={() => {
              if (!confirm(`Remove MFA from ${u.email}? They will need to enroll again.`)) return;
              void run("MFA reset", () => resetUserMfaAction(u.id));
            }}
            onRevoke={() => run("Signed out everywhere", () => revokeUserSessionsAction(u.id))}
          />
        ))}
      </section>
    </div>
  );
}

function UserCard({
  user,
  isSelf,
  onSave,
  onReset,
  onUnlock,
  onResetMfa,
  onRevoke,
}: {
  user: UserRow;
  isSelf: boolean;
  onSave: (patch: { name: string; licenseNumber: string; title: string; phone: string; role: Role; isActive: boolean }) => void;
  onReset: () => void;
  onUnlock: () => void;
  onResetMfa: () => void;
  onRevoke: () => void;
}) {
  const [edit, setEdit] = useState({
    name: user.name,
    licenseNumber: user.licenseNumber,
    title: user.title,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
  });
  const dirty =
    edit.name !== user.name ||
    edit.licenseNumber !== user.licenseNumber ||
    edit.title !== user.title ||
    edit.phone !== user.phone ||
    edit.role !== user.role ||
    edit.isActive !== user.isActive;

  const tags = [
    !user.isActive && "Deactivated",
    user.isLocked && "Locked",
    user.mfaEnabled ? "MFA on" : "MFA off",
    user.mustChangePassword && "Must change password",
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-2xl border border-brand-gold/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {user.name}
            {isSelf ? <span className="ml-2 text-xs text-brand-slate">(you)</span> : null}
          </p>
          <p className="break-all text-sm text-brand-slate">{user.email}</p>
          <p className="text-xs text-brand-slate">
            Last sign-in {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "never"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-brand-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-white/80"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>DFS license #</Label>
          <Input value={edit.licenseNumber} onChange={(e) => setEdit({ ...edit, licenseNumber: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Title (signature)</Label>
          <Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Licensed Public Adjuster" />
        </div>
        <div className="space-y-2">
          <Label>Direct phone</Label>
          <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={edit.role} onValueChange={(v) => setEdit({ ...edit, role: v as Role })} disabled={isSelf}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={edit.isActive}
            disabled={isSelf}
            onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })}
          />
          Active
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!dirty || !edit.name.trim()} onClick={() => onSave(edit)}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          Reset password
        </Button>
        {user.isLocked ? (
          <Button size="sm" variant="ghost" onClick={onUnlock}>
            Unlock
          </Button>
        ) : null}
        {user.mfaEnabled ? (
          <Button size="sm" variant="ghost" onClick={onResetMfa}>
            Reset MFA
          </Button>
        ) : null}
        {!isSelf ? (
          <Button size="sm" variant="ghost" onClick={onRevoke}>
            Sign out everywhere
          </Button>
        ) : null}
      </div>
    </div>
  );
}
