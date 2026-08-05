"use client";

import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

export function ClaimPrintActions({ children }: Props) {
  return (
    <div className="print-sheet space-y-6">
      <div className="no-print flex items-center justify-between gap-4 border-b border-brand-white/10 pb-4">
        <p className="eyebrow">Print Preview</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
