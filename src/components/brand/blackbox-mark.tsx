import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  markClassName?: string;
  as?: "h1" | "span";
};

/** Product wordmark: BLACKBOX™ */
export function BlackboxMark({
  className,
  markClassName,
  as: Tag = "span",
}: Props) {
  return (
    <Tag className={cn("inline-flex items-start", className)}>
      <span>BLACKBOX</span>
      <sup
        className={cn(
          "ml-0.5 translate-y-[-0.15em] font-sans text-[0.35em] font-bold tracking-normal text-brand-gold/80",
          markClassName
        )}
        aria-label="trademark"
      >
        TM
      </sup>
    </Tag>
  );
}
