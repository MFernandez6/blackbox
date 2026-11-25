"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/password-reset";
import { BlackboxMark } from "@/components/brand/blackbox-mark";
import { BlacklineLogo } from "@/components/brand/blackline-mark";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    const result = await requestPasswordResetAction(email);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(result.data.message);
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
            Reset the staff password used by every BLACKSUITE app.
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
        {message ? (
          <p className="mb-6 rounded-xl border border-brand-gold/20 bg-brand-navy/40 px-4 py-3 text-sm text-brand-white/90">
            {message}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="solid" className="w-full" disabled={saving || !email}>
            {saving ? "Sending…" : "Email reset link"}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm">
          <Link href="/login" className="text-brand-gold underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
