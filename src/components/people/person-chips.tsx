import type { PersonRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  PERSON_ROLE_LABELS,
  TEMPERAMENT_CHIP_CLASS,
  temperamentTone,
} from "@/lib/people/labels";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex items-center rounded-md border px-2 py-0.5 font-sans text-[11px] leading-5";

export function RoleBadge({ role, className }: { role: PersonRole; className?: string }) {
  return (
    <Badge className={cn("border-brand-gold/40 text-brand-gold", className)}>
      {PERSON_ROLE_LABELS[role]}
    </Badge>
  );
}

export function LanguageChips({ languages }: { languages: string[] }) {
  if (!languages.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {languages.map((lang) => (
        <span key={lang} className={cn(chip, "border-brand-white/15 text-brand-white/80")}>
          {lang}
        </span>
      ))}
    </div>
  );
}

export function TemperamentChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className={cn(chip, TEMPERAMENT_CHIP_CLASS[temperamentTone(tag)])}>
          {tag}
        </span>
      ))}
    </div>
  );
}

const TOGGLE_ON_CLASS = {
  positive: "border-brand-gold bg-brand-gold/15 text-brand-gold",
  neutral: "border-brand-white/50 bg-brand-white/10 text-brand-white",
  caution: "border-denied bg-denied-muted text-denied-soft",
} as const;

export function ChipToggleGroup({
  options,
  selected,
  onChange,
  tone,
  disabled,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  tone?: keyof typeof TEMPERAMENT_CHIP_CLASS;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() =>
              onChange(on ? selected.filter((s) => s !== option) : [...selected, option])
            }
            className={cn(
              chip,
              "px-2.5 py-1 transition-colors disabled:opacity-50",
              on
                ? TOGGLE_ON_CLASS[tone ?? "positive"]
                : "border-brand-white/10 text-brand-slate hover:border-brand-gold/40 hover:text-brand-white"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
