"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, type LifecycleStage } from "@/lib/letter/stage-map";

type NextPayload = {
  complete: boolean;
  next: {
    name: string;
    reason: string;
    stage: string;
    required: boolean;
  } | null;
};

export function NextDocumentCard({
  claimId,
  claimNumber,
  letterUrl,
}: {
  claimId: string;
  claimNumber: string;
  letterUrl: string;
}) {
  const [data, setData] = useState<NextPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/letter/next?claimId=${encodeURIComponent(claimId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  const claimHref = `${letterUrl.replace(/\/$/, "")}/claims/${encodeURIComponent(claimNumber)}?claimId=${encodeURIComponent(claimId)}`;
  const stage = data?.next
    ? STAGE_LABELS[data.next.stage as LifecycleStage] ?? data.next.stage
    : data?.complete
      ? "Stage clear"
      : null;

  return (
    <div className="border border-brand-white/10">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow">
            BLACKLETTER
            {stage ? ` · ${stage}` : ""}
            {data?.next?.required ? " · Required" : ""}
          </p>
          <p className="mt-2 font-serif text-lg tracking-wide text-brand-white">
            {!data
              ? "Reading document stage…"
              : data.next?.name ?? "Required documents for this stage are on file."}
          </p>
          {data?.next?.reason ? (
            <p className="mt-1 max-w-2xl text-sm text-brand-slate">
              {data.next.reason}
            </p>
          ) : null}
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <a href={claimHref}>Open BLACKLETTER</a>
        </Button>
      </div>
    </div>
  );
}
