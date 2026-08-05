"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/lib/schemas/claim";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner } from "@/components/ui/error-banner";

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
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
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(198,168,91,0.12), transparent)",
        }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mb-6 flex flex-col items-center leading-none">
            <span className="font-serif text-2xl font-bold tracking-[0.2em] text-brand-gold sm:text-3xl">
              BLACKLINE
            </span>
            <span className="mt-2 font-serif text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-brand-white/88">
              PUBLIC ADJUSTERS{" "}
              <span className="font-medium text-brand-slate">LLC</span>
            </span>
          </div>
          <p className="eyebrow mb-2">Secure Protocol</p>
          <h1 className="font-serif text-xl font-semibold tracking-[0.14em] text-brand-white">
            BLACKBOX
          </h1>
          <p className="mt-3 text-sm text-brand-slate">
            Authorized personnel — claim file access only
          </p>
        </div>

        <div className="hairline mb-8" />

        {error ? (
          <ErrorBanner
            message={error}
            onDismiss={() => setError("")}
            className="mb-6"
          />
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          <Button type="submit" variant="solid" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Authenticating…" : "Enter"}
          </Button>
        </form>

        <p className="mt-8 text-center font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
          Chain of custody · session encrypted
        </p>
      </div>
    </div>
  );
}
