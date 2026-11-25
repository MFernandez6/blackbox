"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/lib/actions/password-reset";
import { BlackboxMark } from "@/components/brand/blackbox-mark";
import { BlacklineLogo } from "@/components/brand/blackline-mark";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH, passwordProblems } from "@/lib/security/password-policy";

export default function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(token ? "" : "This reset link is missing or incomplete.");
  const [saving, setSaving] = useState(false);
  const problems = next ? passwordProblems(next) : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    const result = await resetPasswordAction({ token, newPassword: next });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/login?reason=password");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <div className="relative w-full max-w-sm animate-fade-up motion-reduce:animate-none">
        <div className="mb-8 text-center">
          <p className="eyebrow mb-4">Internal claims system</p>
          <BlackboxMark
            as="h1"
            className="justify-center font-serif text-4xl font-bold tracking-[0.22em] text-brand-gold sm:text-5xl"
          />
          <p className="mt-4 text-sm leading-relaxed text-brand-white/80">
            Choose a new staff password. It replaces the password on every BLACKSUITE app.
          </p>
        </div>

        <div className="mb-8 border border-brand-gold/15 bg-brand-navy/40 px-4 py-5 text-center rounded-2xl">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
            Operated for
          </p>
          <BlacklineLogo className="mx-auto mt-4 w-44" priority />
        </div>

        <div className="hairline mb-8" />

        {error ? <ErrorBanner message={error} onDismiss={() => setError("")} className="mb-6" /> : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
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
              required
            />
          </div>
          <p className="text-xs text-brand-slate">
            {problems.length
              ? `Still needed: ${problems.join(" · ")}`
              : next
                ? "Meets policy."
                : `At least ${PASSWORD_MIN_LENGTH} characters with upper- and lower-case letters, a number and a symbol.`}
          </p>
          <Button
            type="submit"
            variant="solid"
            className="w-full"
            disabled={saving || !token || problems.length > 0 || !next}
          >
            {saving ? "Saving…" : "Save password"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm">
          <Link href="/forgot-password" className="text-brand-gold underline underline-offset-4">
            Request a new link
          </Link>
        </p>
      </div>
    </div>
  );
}
