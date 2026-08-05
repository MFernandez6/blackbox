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
      <span
        className={cn(
          "ml-0.5 mt-[0.32em] font-sans text-[0.38em] font-semibold leading-none tracking-normal text-brand-gold/80",
          markClassName
        )}
        aria-label="trademark"
      >
        TM
      </span>
    </Tag>
  );
}
