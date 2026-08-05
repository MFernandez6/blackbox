"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  claimantSchema,
  claimPropertySchema,
  claimPolicySchema,
  type FnolIntakeInput,
} from "@/lib/schemas/claim";
import { createClaimAction } from "@/lib/actions/claims";
import { suggestCountyFromZip } from "@/lib/zip-county";
import { contingencyForCat } from "@/lib/utils";
import { LOSS_TYPE_LABELS, CONTACT_METHOD_LABELS } from "@/lib/claims/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ErrorBanner } from "@/components/ui/error-banner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { z } from "zod";

const STORAGE_KEY = "blackbox-fnol-draft";

const draftSchema = z.object({
  claimants: z.array(claimantSchema).min(1),
  property: claimPropertySchema,
  policy: claimPolicySchema,
});

type Draft = z.infer<typeof draftSchema>;

const defaultValues: Draft = {
  claimants: [
    {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      mailingAddress: "",
      preferredContactMethod: "EMAIL",
      isPrimaryContact: true,
    },
  ],
  property: {
    propertyAddress: "",
    zipCode: "",
    county: "",
    lossType: "WATER",
    dateOfLoss: "",
    lossDescription: "",
    isCatClaim: false,
  },
  policy: {
    policyNumber: "",
    carrierName: "",
    estimatedValue: null,
  },
};

const STEPS = [
  { n: "01", label: "Claimant" },
  { n: "02", label: "Property / Loss" },
  { n: "03", label: "Policy / Carrier" },
  { n: "04", label: "Review" },
] as const;

export function FnolWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const form = useForm<Draft>({
    defaultValues,
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "claimants",
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = draftSchema.safeParse(JSON.parse(raw));
        if (parsed.success) form.reset(parsed.data);
      }
    } catch {
      /* ignore corrupt draft */
    }
    setHydrated(true);
  }, [form]);

  const persist = useCallback(() => {
    if (!hydrated) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form.getValues()));
  }, [form, hydrated]);

  useEffect(() => {
    const sub = form.watch(() => persist());
    return () => sub.unsubscribe();
  }, [form, persist]);

  async function validateStep(): Promise<boolean> {
    setError("");
    if (step === 0) {
      const ok = await form.trigger("claimants");
      if (!ok) return false;
      const claimants = form.getValues("claimants");
      const primaryCount = claimants.filter((c) => c.isPrimaryContact).length;
      if (primaryCount !== 1) {
        setError("Designate exactly one primary contact.");
        return false;
      }
      return true;
    }
    if (step === 1) return form.trigger("property");
    if (step === 2) return form.trigger("policy");
    return true;
  }

  async function next() {
    if (!(await validateStep())) return;
    setStep((s) => Math.min(s + 1, 3));
  }

  async function submit() {
    setError("");
    const values = form.getValues();
    const parsed = draftSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Validation failed.");
      return;
    }

    const payload: FnolIntakeInput = parsed.data;
    const result = await createClaimAction(payload);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    sessionStorage.removeItem(STORAGE_KEY);
    toast.success(`Record sealed — ${result.data.claimNumber}`);
    router.push(`/claims/${result.data.id}`);
  }

  const values = form.watch();
  const fee = contingencyForCat(values.property?.isCatClaim ?? false);

  if (!hydrated) {
    return (
      <div className="border border-brand-white/10 p-8">
        <p className="eyebrow">Evidence Protocol</p>
        <p className="mt-2 text-sm text-brand-slate">Loading draft…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="eyebrow">Evidence Protocol</p>
        <h1 className="mt-1 font-serif text-2xl text-brand-white">FNOL Intake</h1>
      </div>

      <div className="flex flex-wrap gap-6 border-b border-brand-white/10 pb-4">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-baseline gap-2">
            <span
              className={`font-mono text-sm tracking-widest ${
                i === step ? "text-brand-gold" : "text-brand-slate"
              }`}
            >
              {s.n}
            </span>
            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              / 04 — {s.label}
            </span>
          </div>
        ))}
      </div>

      {error ? (
        <ErrorBanner message={error} onDismiss={() => setError("")} />
      ) : null}

      {step === 0 && (
        <div className="space-y-6">
          {fields.map((field, index) => (
            <div key={field.id} className="space-y-4 border border-brand-white/10 p-5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Claimant {String(index + 1).padStart(2, "0")}</p>
                {fields.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First Name" error={form.formState.errors.claimants?.[index]?.firstName?.message}>
                  <Input {...form.register(`claimants.${index}.firstName`)} />
                </Field>
                <Field label="Last Name" error={form.formState.errors.claimants?.[index]?.lastName?.message}>
                  <Input {...form.register(`claimants.${index}.lastName`)} />
                </Field>
                <Field label="Email" error={form.formState.errors.claimants?.[index]?.email?.message}>
                  <Input type="email" {...form.register(`claimants.${index}.email`)} />
                </Field>
                <Field label="Phone" error={form.formState.errors.claimants?.[index]?.phone?.message}>
                  <Input {...form.register(`claimants.${index}.phone`)} />
                </Field>
                <Field
                  label="Mailing Address"
                  className="sm:col-span-2"
                  error={form.formState.errors.claimants?.[index]?.mailingAddress?.message}
                >
                  <Input {...form.register(`claimants.${index}.mailingAddress`)} />
                </Field>
                <Field label="Preferred Contact">
                  <Select
                    value={form.watch(`claimants.${index}.preferredContactMethod`)}
                    onValueChange={(v) =>
                      form.setValue(
                        `claimants.${index}.preferredContactMethod`,
                        v as "EMAIL" | "PHONE" | "TEXT",
                        { shouldDirty: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTACT_METHOD_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-end gap-2 pb-2">
                  <Checkbox
                    checked={form.watch(`claimants.${index}.isPrimaryContact`)}
                    onCheckedChange={(checked) => {
                      const next = fields.map((_, i) => ({
                        ...form.getValues(`claimants.${i}`),
                        isPrimaryContact: i === index ? !!checked : false,
                      }));
                      if (checked) {
                        form.setValue("claimants", next);
                      } else {
                        form.setValue(`claimants.${index}.isPrimaryContact`, false);
                      }
                    }}
                  />
                  <Label className="normal-case tracking-normal font-sans text-sm text-brand-white">
                    Primary contact
                  </Label>
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
                mailingAddress: "",
                preferredContactMethod: "EMAIL",
                isPrimaryContact: false,
              })
            }
          >
            Add Claimant
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 border border-brand-white/10 p-5">
          <Field label="Property Address" error={form.formState.errors.property?.propertyAddress?.message}>
            <Input {...form.register("property.propertyAddress")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ZIP" error={form.formState.errors.property?.zipCode?.message}>
              <Input
                {...form.register("property.zipCode", {
                  onChange: (e) => {
                    const suggested = suggestCountyFromZip(e.target.value);
                    if (suggested && !form.getValues("property.county")) {
                      form.setValue("property.county", suggested);
                    } else if (suggested) {
                      form.setValue("property.county", suggested);
                    }
                  },
                })}
              />
            </Field>
            <Field label="County" error={form.formState.errors.property?.county?.message}>
              <Input {...form.register("property.county")} />
            </Field>
            <Field label="Loss Type">
              <Select
                value={form.watch("property.lossType")}
                onValueChange={(v) =>
                  form.setValue("property.lossType", v as Draft["property"]["lossType"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOSS_TYPE_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date of Loss" error={form.formState.errors.property?.dateOfLoss?.message}>
              <Input type="date" {...form.register("property.dateOfLoss")} />
            </Field>
          </div>
          <Field label="Loss Description" error={form.formState.errors.property?.lossDescription?.message}>
            <Textarea rows={4} {...form.register("property.lossDescription")} />
          </Field>
          <div className="flex items-center gap-2 border-t border-brand-white/10 pt-4">
            <Checkbox
              checked={form.watch("property.isCatClaim")}
              onCheckedChange={(c) =>
                form.setValue("property.isCatClaim", !!c)
              }
            />
            <div>
              <Label className="normal-case tracking-normal font-sans text-sm text-brand-white">
                CAT claim (declared catastrophe)
              </Label>
              <p className="mt-1 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                Contingency: {fee}%
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 border border-brand-white/10 p-5">
          <p className="text-sm text-brand-slate">
            Policy and carrier fields may be left blank when unknown at first contact.
          </p>
          <Field label="Policy Number">
            <Input {...form.register("policy.policyNumber")} />
          </Field>
          <Field label="Carrier Name">
            <Input {...form.register("policy.carrierName")} />
          </Field>
          <Field label="Estimated Value (USD)">
            <Input
              type="number"
              step="1"
              {...form.register("policy.estimatedValue")}
            />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <ReviewBlock title="Claimants">
            {values.claimants.map((c, i) => (
              <p key={i} className="text-sm">
                {c.firstName} {c.lastName}
                {c.isPrimaryContact ? " · Primary" : ""} — {c.email} · {c.phone}
              </p>
            ))}
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setStep(0)}>
              Edit
            </Button>
          </ReviewBlock>
          <ReviewBlock title="Property & Loss">
            <p className="text-sm">{values.property.propertyAddress}</p>
            <p className="text-sm text-brand-slate">
              {values.property.zipCode} · {values.property.county} ·{" "}
              {LOSS_TYPE_LABELS[values.property.lossType]} · DOL{" "}
              {values.property.dateOfLoss}
              {values.property.isCatClaim ? " · CAT" : ""}
            </p>
            <p className="mt-2 text-sm">{values.property.lossDescription}</p>
            <p className="mt-2 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-brand-slate">
              Contingency fee: {fee}%
            </p>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setStep(1)}>
              Edit
            </Button>
          </ReviewBlock>
          <ReviewBlock title="Policy / Carrier">
            <p className="text-sm">
              Policy: {values.policy.policyNumber || "—"} · Carrier:{" "}
              {values.policy.carrierName || "—"} · Est:{" "}
              {values.policy.estimatedValue ?? "—"}
            </p>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setStep(2)}>
              Edit
            </Button>
          </ReviewBlock>
        </div>
      )}

      <div className="flex justify-between border-t border-brand-white/10 pt-6">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={next}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit}>
            Seal Record
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-denied">{error}</p> : null}
    </div>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-brand-white/10 p-5">
      <p className="eyebrow mb-3">{title}</p>
      {children}
    </div>
  );
}
