"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
  claimNumber?: string;
};

export function ClaimPrintActions({ children, claimNumber }: Props) {
  const params = useParams();
  const claimId = typeof params?.id === "string" ? params.id : "";

  return (
    <div className="print-sheet space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-brand-white/10 pb-4">
        <div>
          <p className="eyebrow">Demand Packet</p>
          <p className="mt-1 text-sm text-brand-slate">
            Use Print → Save as PDF for a downloadable packet
            {claimNumber ? ` (${claimNumber})` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {claimId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/claims/${claimId}?tab=demand`}>Back to File</Link>
            </Button>
          ) : null}
          <Button size="sm" variant="solid" onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
