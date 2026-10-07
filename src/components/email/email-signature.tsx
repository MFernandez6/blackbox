import { BlacklineLogo } from "@/components/brand/blackline-mark";
import {
  FIRM_SIGNATURE,
  type EmailSignatory,
} from "@/lib/email/signatures";

export function EmailSignature({ signatory }: { signatory: EmailSignatory }) {
  const contact = [
    signatory.email,
    signatory.phone,
    signatory.license ? `Lic. ${signatory.license}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside className="mt-4 max-w-xl border-t border-brand-gold/40 pt-4">
      <div className="flex items-center gap-4">
        <BlacklineLogo className="w-[92px] shrink-0" />
        <div className="h-16 w-px shrink-0 bg-brand-gold/70" aria-hidden />
        <div className="min-w-0">
          <p className="font-serif text-[15px] leading-tight text-brand-white">
            {signatory.name}
          </p>
          <p className="mt-1 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
            {signatory.title}
          </p>
          <p className="mt-2 font-sans text-[11px] leading-relaxed text-brand-slate">
            {FIRM_SIGNATURE.name}
            <br />
            {contact}
            <br />
            {FIRM_SIGNATURE.address}
            <br />
            {FIRM_SIGNATURE.website}
          </p>
        </div>
      </div>
    </aside>
  );
}
