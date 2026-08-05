"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ErrorBannerProps = {
  message: string;
  onDismiss?: () => void;
  className?: string;
};

export function ErrorBanner({ message, onDismiss, className }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start justify-between gap-4 border border-denied bg-denied/15 px-4 py-3 text-sm text-paper",
        className
      )}
    >
      <p>{message}</p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-paper/70 hover:text-paper"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
