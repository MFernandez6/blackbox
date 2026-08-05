import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse border border-brand-white/10 bg-brand-navy-deep/60",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
