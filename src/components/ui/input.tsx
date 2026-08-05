import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full min-w-0 max-w-full border border-brand-white/15 bg-brand-navy-deep/50 px-3 py-2 text-sm text-brand-white placeholder:text-brand-slate/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-gold/50 disabled:cursor-not-allowed disabled:opacity-50 font-sans",
          (type === "date" ||
            type === "time" ||
            type === "datetime-local" ||
            type === "month" ||
            type === "week") &&
            "appearance-none",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
