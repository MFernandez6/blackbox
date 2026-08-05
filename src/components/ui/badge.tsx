import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center border px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.2em]",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
