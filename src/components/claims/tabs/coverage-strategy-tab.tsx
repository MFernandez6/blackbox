"use client";

import { useState } from "react";
import { LOSS_TYPE_LABELS } from "@/lib/claims/labels";
import {
  STANCE_LABEL,
  buildCoverageStrategy,
  type StrategyPlay,
  type StrategyStance,
} from "@/lib/claims/coverage-strategy";
import type { ClaimWorkspaceProps } from "@/components/claims/claim-detail-types";
import { Button } from "@/components/ui/button";

const STANCE_CLASS: Record<StrategyStance, string> = {
  pursue: "border-brand-gold/50 text-brand-gold",
  confirm: "border-brand-white/20 text-brand-white/80",
  hold: "border-brand-white/10 text-brand-slate",
};

function PlayCard({ play }: { play: StrategyPlay }) {
  return (
    <article className="border border-brand-gold/15 p-4 rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-slate">
            {play.coverage}
          </p>
          <h3 className="mt-1 font-serif text-lg text-brand-white">{play.title}</h3>
        </div>
        <p
          className={`shrink-0 border px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-[0.16em] ${STANCE_CLASS[play.stance]}`}
        >
          {STANCE_LABEL[play.stance]}
        </p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-brand-white/85">{play.summary}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-brand-slate">
        {play.actions.map((action) => (
          <li key={action} className="flex gap-2">
            <span className="text-brand-gold" aria-hidden>
              –
            </span>
            <span>{action}</span>
          </li>
        ))}
      </ul>
      {play.policy ? (
        <div className="mt-4 border-t border-brand-gold/20 pt-3 text-sm">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-brand-gold">
            From the parsed policy
          </p>
          <p className="mt-2 text-brand-white/90">
            {play.policy.limit ? `Limit ${play.policy.limit}` : "No limit listed for this coverage"}
            <span className="text-brand-slate"> · {play.policy.source}</span>
          </p>
          {play.policy.endorsement ? (
            <p className="mt-2 text-brand-white/80">
              <span className="text-brand-gold">Endorsement. </span>
              {play.policy.endorsement}
            </p>
          ) : null}
          {play.policy.exclusion ? (
            <p className="mt-2 text-brand-white/80">
              <span className="text-brand-gold">Read before you drop it. </span>
              {play.policy.exclusion}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function CoverageStrategyTab({ claim }: ClaimWorkspaceProps) {
  const [applied, setApplied] = useState(false);
  const strategy = buildCoverageStrategy(claim, applied);
  const confirmCount = strategy.plays.filter((p) => p.stance === "confirm").length;

  return (
    <div className="space-y-6">
      <section className="border border-brand-gold/15 p-4 sm:p-5 rounded-2xl">
        <p className="eyebrow">Coverage Strategy</p>
        <h2 className="mt-2 font-serif text-2xl text-brand-white">
          {LOSS_TYPE_LABELS[claim.lossType]} loss
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-white/80">
          The dwelling is the starting point. Contents, other structures, and loss of use
          are separate limits, and {confirmCount} more{" "}
          {confirmCount === 1 ? "coverage still needs" : "coverages still need"} a yes
          or no before the estimate goes out. Apply the parsed policy to put the real
          limits, endorsements, and exclusions on each one.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {strategy.applied ? (
            <Button size="sm" variant="outline" onClick={() => setApplied(false)}>
              General strategy
            </Button>
          ) : (
            <Button
              size="sm"
              variant="solid"
              disabled={!strategy.canApply}
              onClick={() => setApplied(true)}
            >
              Apply parsed policy
            </Button>
          )}
          <p className="text-xs text-brand-slate">
            {strategy.canApply
              ? strategy.applied
                ? strategy.frameLabel
                : "Parsed policy is on the file"
              : "Parse the policy on Overview, then apply it here"}
          </p>
        </div>
        {strategy.applied && strategy.sources.length ? (
          <p className="mt-3 text-sm text-brand-white/75">
            {strategy.sources.join("  ·  ")}
          </p>
        ) : null}
        {strategy.applied && strategy.deductible ? (
          <p className="mt-2 text-sm text-brand-slate">
            Deductible notes: {strategy.deductible}
          </p>
        ) : null}
        {strategy.aside ? (
          <p className="mt-3 text-sm text-brand-white/80">{strategy.aside}</p>
        ) : null}
      </section>

      <div className="space-y-3">
        {strategy.plays.map((play) => (
          <PlayCard key={play.id} play={play} />
        ))}
      </div>
    </div>
  );
}
