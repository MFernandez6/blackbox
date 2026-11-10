"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  beginMfaEnrollmentAction,
  changePasswordAction,
  confirmMfaEnrollmentAction,
  disableMfaAction,
} from "@/lib/actions/account";
import { PASSWORD_MIN_LENGTH, passwordProblems } from "@/lib/security/password-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";

type Props = {
  required: "password" | "mfa" | null;
  mfaMandatory: boolean;
  user: {
    name: string;
    email: string;
    role: string;
    licenseNumber: string;
    mfaEnabled: boolean;
    passwordChangedAt: string | null;
    lastLoginAt: string | null;
  };
  events: Array<{ id: string; event: string; app: string; ip: string | null; createdAt: string }>;
};

const EVENT_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Signed in",
  LOGIN_FAILURE: "Failed sign-in",
  LOCKED: "Account locked",
  MFA_FAILURE: "Wrong authenticator code",
  PASSWORD_CHANGED: "Password changed",
  PASSWORD_RESET: "Password reset by admin",
  MFA_ENABLED: "MFA enabled",
  MFA_DISABLED: "MFA disabled",
  USER_CREATED: "Account created",
  USER_UPDATED: "Account updated",
  THROTTLED: "Sign-in throttled",
};

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export function AccountSecurity({ required, mfaMandatory, user, events }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="eyebrow">Account</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold tracking-[0.06em] text-brand-white">
          Security
        </h1>
        <p className="mt-2 text-sm text-brand-slate">
          {user.name} · {user.email} · {user.role}
          {user.licenseNumber ? ` · License ${user.licenseNumber}` : ""}
        </p>
      </div>

      {required === "password" ? (
        <ErrorBanner message="Set a new password before continuing. Your current password was issued by an admin or does not meet policy." />
      ) : null}
      {required === "mfa" ? (
        <ErrorBanner message="Admin accounts must enable multi-factor authentication before continuing." />
      ) : null}

      <PasswordSection user={user} />
      <MfaSection enabled={user.mfaEnabled} mandatory={mfaMandatory} />

      <section className="rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
        <p className="eyebrow mb-3">Recent sign-in activity</p>
        <p className="mb-3 text-xs text-brand-slate">
          Last sign-in {when(user.lastLoginAt)} · password changed {when(user.passwordChangedAt)}
        </p>
        <ul className="divide-y divide-brand-white/10 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{EVENT_LABELS[e.event] ?? e.event}</span>
              <span className="text-xs text-brand-slate">
                {e.app} · {e.ip ?? "unknown IP"} · {when(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PasswordSection({ user }: { user: Props["user"] }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const problems = next ? passwordProblems(next, { email: user.email, name: user.name }) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    const result = await changePasswordAction({ currentPassword: current, newPassword: next });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Password changed — sign in again");
    await signOut({ callbackUrl: "/login?reason=password" });
  }

  return (
    <section className="rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
      <p className="eyebrow mb-1">Password</p>
      <p className="mb-4 text-xs text-brand-slate">
        Changing your password signs you out of every BLACKSUITE app and device.
      </p>
      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" /> : null}
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <p className="text-xs text-brand-slate sm:col-span-2">
          {problems.length
            ? `Still needed: ${problems.join(" · ")}`
            : next
              ? "Meets policy."
              : `At least ${PASSWORD_MIN_LENGTH} characters with upper- and lower-case letters, a number and a symbol.`}
        </p>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={saving || !current || problems.length > 0 || !next}
          >
            {saving ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function MfaSection({ enabled, mandatory }: { enabled: boolean; mandatory: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState("");
  const [enroll, setEnroll] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setError("");
    setBusy(true);
    const result = await beginMfaEnrollmentAction();
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setEnroll(result.data);
  }

  async function confirm() {
    setError("");
    setBusy(true);
    const result = await confirmMfaEnrollmentAction(code);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    toast.success("MFA enabled");
    setEnroll(null);
    setCode("");
    await update();
    router.push("/dashboard");
    router.refresh();
  }

  async function disable() {
    setError("");
    setBusy(true);
    const result = await disableMfaAction({ password, code });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    toast.success("MFA disabled — sign in again");
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <section className="rounded-2xl border border-brand-gold/15 p-4 sm:p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="eyebrow">Multi-factor authentication</p>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-slate">
          {enabled ? "On" : "Off"}
        </span>
      </div>
      <p className="mb-4 text-xs text-brand-slate">
        A 6-digit code from an authenticator app (Google Authenticator, 1Password, Authy) is required at
        every sign-in, on every BLACKSUITE app.
      </p>
      {error ? <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-4" /> : null}

      {!enabled && !enroll ? (
        <Button size="sm" variant="outline" onClick={start} disabled={busy}>
          Set up MFA
        </Button>
      ) : null}

      {!enabled && enroll ? (
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qrDataUrl} alt="MFA setup QR code" className="h-[220px] w-[220px] rounded-lg bg-white p-2" />
          <div className="space-y-3">
            <p className="text-sm">Scan the code with your authenticator app, then enter the 6-digit code it shows.</p>
            <p className="break-all font-mono text-xs text-brand-slate">Manual key: {enroll.secret}</p>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button size="sm" variant="outline" onClick={confirm} disabled={busy || code.length !== 6}>
              Verify and enable
            </Button>
          </div>
        </div>
      ) : null}

      {enabled && !mandatory ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="mfa-password">Password</Label>
            <Input
              id="mfa-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mfa-code">Current code</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button size="sm" variant="outline" onClick={disable} disabled={busy || !password || code.length !== 6}>
            Turn off MFA
          </Button>
        </div>
      ) : null}
      {enabled && mandatory ? (
        <p className="text-sm text-brand-white/80">MFA is required for admin accounts and cannot be turned off.</p>
      ) : null}
    </section>
  );
}
