import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl border border-brand-gold/10 bg-brand-navy/40",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
