"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/schemas/claim";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";
import { BlackboxMark } from "@/components/brand/blackbox-mark";

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idleNotice = searchParams.get("reason") === "idle";
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginValues) {
    setError("");
    const res = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (res?.error) {
      setError("Credentials rejected. Access denied.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(198,168,91,0.1), transparent)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Product first */}
        <div className="mb-8 text-center">
          <p className="eyebrow mb-4">Internal claims system</p>
          <BlackboxMark
            as="h1"
            className="justify-center font-serif text-4xl font-bold tracking-[0.22em] text-brand-gold sm:text-5xl"
          />
          <p className="mt-4 text-sm leading-relaxed text-brand-white/80">
            Secure file operations for public adjusting staff.
            Not a client portal.
          </p>
        </div>

        {/* Firm attribution — secondary, clearly separate */}
        <div className="mb-8 border border-brand-white/10 bg-brand-navy-deep/40 px-4 py-3 text-center">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
            Operated for
          </p>
          <p className="mt-1.5 font-serif text-xs font-semibold tracking-[0.14em] text-brand-white/85">
            BLACKLINE PUBLIC ADJUSTERS LLC
          </p>
        </div>

        <div className="hairline mb-8" />

        {idleNotice ? (
          <ErrorBanner
            message="Signed out after 5 minutes of inactivity. Sign in again to continue."
            className="mb-6"
          />
        ) : null}

        {error ? (
          <ErrorBanner
            message={error}
            onDismiss={() => setError("")}
            className="mb-6"
          />
        ) : null}

        <form
          method="post"
          action="#"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-xs text-denied">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-xs text-denied">{errors.password.message}</p>
            ) : null}
          </div>
          <Button
            type="submit"
            variant="solid"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Authenticating…" : "Enter BLACKBOX™"}
          </Button>
        </form>

        <p className="mt-8 text-center font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
          Authorized personnel only · session encrypted
        </p>
      </div>
    </div>
  );
}
