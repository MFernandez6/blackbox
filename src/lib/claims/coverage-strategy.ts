import type { LossType, PolicyLine } from "@prisma/client";
import type { ClaimPolicyDetail } from "@/components/claims/claim-detail-types";
import { POLICY_LINE_LABELS } from "@/lib/claims/labels";
import type { PolicyLimitRow } from "@/lib/policy-extraction";
import { formatCurrency } from "@/lib/utils";

export type StrategyStance = "pursue" | "confirm" | "hold";

export type StrategyPolicyNote = {
  source: string;
  limit: string | null;
  endorsement: string | null;
  exclusion: string | null;
};

export type StrategyPlay = {
  id: string;
  coverage: string;
  title: string;
  stance: StrategyStance;
  summary: string;
  actions: string[];
  policy: StrategyPolicyNote | null;
};

export type StrategySource = {
  line: PolicyLine;
  label: string;
  isPrimary: boolean;
  limits: PolicyLimitRow[];
  deductibleNotes: string | null;
  corpus: string;
};

export type CoverageStrategy = {
  frame: PolicyLine;
  frameLabel: string;
  applied: boolean;
  canApply: boolean;
  deductible: string | null;
  sources: string[];
  aside: string | null;
  plays: StrategyPlay[];
};

type StrategyClaim = {
  lossType: LossType;
  lossDescription: string | null;
  carrierName: string | null;
  policyNumber: string | null;
  coverageALimit: string | null;
  coverageBLimit: string | null;
  coverageCLimit: string | null;
  coverageDLimit: string | null;
  policyExclusions: string | null;
  policyEndorsements: string | null;
  coverageAnalysis: string | null;
  policyParsedAt: string | null;
  policies: ClaimPolicyDetail[];
};

type Seed = {
  id: string;
  coverage: string;
  title: string;
  stance: StrategyStance;
  summary: string;
  actions: string[];
  keys: string[];
  labels: string[];
  endorsement?: RegExp;
  exclusion?: RegExp;
  boost?: RegExp;
};

const PROPERTY_LINES = new Set<PolicyLine>([
  "HOMEOWNERS",
  "CONDO_MASTER",
  "COMMERCIAL_PROPERTY",
  "FLOOD",
]);

const LIABILITY_LINES = new Set<PolicyLine>([
  "CGL",
  "UMBRELLA",
  "EXCESS",
  "AUTO",
  "WORKERS_COMP",
]);

function money(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clip(text: string, pattern: RegExp): string | null {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const match = new RegExp(pattern.source, flags).exec(text);
  if (!match) return null;
  const start = Math.max(0, match.index - 48);
  const end = Math.min(text.length, match.index + match[0].length + 90);
  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${end < text.length ? "…" : ""}`;
}

function findLimit(limits: PolicyLimitRow[], seed: Seed): PolicyLimitRow | null {
  const keys = seed.keys.map((k) => k.toLowerCase());
  const labels = seed.labels.map((k) => k.toLowerCase());
  return (
    limits.find((row) => keys.includes(row.key.toLowerCase())) ??
    limits.find((row) => {
      const label = row.label.toLowerCase();
      return labels.some((bit) => label.includes(bit));
    }) ??
    null
  );
}

function legacyLimits(claim: StrategyClaim): PolicyLimitRow[] {
  return [
    { key: "coverage_a", label: "Coverage A — Dwelling", amount: money(claim.coverageALimit) },
    { key: "coverage_b", label: "Coverage B — Other Structures", amount: money(claim.coverageBLimit) },
    { key: "coverage_c", label: "Coverage C — Personal Property", amount: money(claim.coverageCLimit) },
    { key: "coverage_d", label: "Coverage D — Loss of Use / ALE", amount: money(claim.coverageDLimit) },
  ].filter((row) => row.amount !== null);
}

function collectSources(claim: StrategyClaim): StrategySource[] {
  const claimCorpus = [
    claim.policyExclusions,
    claim.policyEndorsements,
    claim.coverageAnalysis,
  ]
    .filter(Boolean)
    .join("\n");

  const parsedRows = claim.policies.filter(
    (p) =>
      p.parsedAt ||
      p.limits.some((l) => l.amount !== null) ||
      p.exclusions ||
      p.endorsements ||
      p.deductibleNotes ||
      p.analysis
  );
  const liabilityOnly =
    parsedRows.length > 0 && parsedRows.every((p) => LIABILITY_LINES.has(p.line));

  const sources: StrategySource[] = parsedRows.map((policy) => ({
    line: policy.line,
    label:
      [policy.label, policy.carrierName ?? claim.carrierName, policy.policyNumber ?? claim.policyNumber]
        .filter(Boolean)
        .join(" · ") || POLICY_LINE_LABELS[policy.line],
    isPrimary: policy.isPrimary,
    limits: policy.limits,
    deductibleNotes: policy.deductibleNotes,
    corpus: [
      policy.exclusions,
      policy.endorsements,
      policy.analysis,
      policy.deductibleNotes,
      liabilityOnly ? null : claimCorpus,
    ]
      .filter(Boolean)
      .join("\n"),
  }));

  const hasPropertyLimits = sources.some(
    (s) => PROPERTY_LINES.has(s.line) && s.limits.some((l) => l.amount !== null)
  );
  const legacy = legacyLimits(claim);
  if (!hasPropertyLimits && (legacy.length || (claim.policyParsedAt && !liabilityOnly))) {
    sources.unshift({
      line: "HOMEOWNERS",
      label: liabilityOnly
        ? "Coverage limits on the file"
        : [claim.carrierName, claim.policyNumber].filter(Boolean).join(" · ") ||
          "Coverage limits on the file",
      isPrimary: true,
      limits: legacy,
      deductibleNotes: null,
      corpus: liabilityOnly ? "" : claimCorpus,
    });
  } else if (sources.length === 0 && (legacy.length || claim.policyParsedAt || claimCorpus.trim())) {
    sources.push({
      line: "HOMEOWNERS",
      label:
        [claim.carrierName, claim.policyNumber].filter(Boolean).join(" · ") ||
        "Coverage limits on the file",
      isPrimary: true,
      limits: legacy,
      deductibleNotes: null,
      corpus: claimCorpus,
    });
  }

  return sources;
}

export function claimHasParsedPolicy(claim: StrategyClaim): boolean {
  return collectSources(claim).length > 0;
}

function frameFor(sources: StrategySource[], applied: boolean): PolicyLine {
  if (!applied) return "HOMEOWNERS";
  const primary = sources.find((s) => s.isPrimary && PROPERTY_LINES.has(s.line));
  if (primary) return primary.line;
  const property = sources.find((s) => PROPERTY_LINES.has(s.line));
  return property?.line ?? "HOMEOWNERS";
}

function boostStance(stance: StrategyStance, description: string, pattern?: RegExp): StrategyStance {
  if (!pattern || !pattern.test(description)) return stance;
  if (stance === "hold") return "confirm";
  if (stance === "confirm") return "pursue";
  return stance;
}

function attachPolicy(seed: Seed, sources: StrategySource[], frame: PolicyLine): StrategyPolicyNote | null {
  const ordered = [
    ...sources.filter((s) => s.line === frame),
    ...sources.filter((s) => s.line !== frame && PROPERTY_LINES.has(s.line)),
  ];
  const hit = ordered
    .map((source) => ({ source, limit: findLimit(source.limits, seed) }))
    .find((row) => row.limit);
  const corpus = ordered.map((s) => s.corpus).join("\n");
  const source = hit?.source ?? ordered[0];
  if (!source && !corpus.trim()) return null;
  return {
    source: source?.label ?? "Parsed policy",
    limit: hit?.limit?.amount != null ? formatCurrency(hit.limit.amount) : null,
    endorsement: seed.endorsement ? clip(corpus, seed.endorsement) : null,
    exclusion: seed.exclusion ? clip(corpus, seed.exclusion) : null,
  };
}

function play(seed: Seed, description: string, policy: StrategyPolicyNote | null): StrategyPlay {
  return {
    id: seed.id,
    coverage: seed.coverage,
    title: seed.title,
    stance: boostStance(seed.stance, description, seed.boost),
    summary: seed.summary,
    actions: seed.actions,
    policy,
  };
}

const CONTENTS = /content|furniture|cloth|belonging|personal property|electronics/i;
const ALE = /hotel|airbnb|displac|uninhabit|cannot live|can't live|living expense|\bale\b|staying with/i;
const OTHER = /fence|shed|detached|pool|screen|lanai|carport|garage/i;
const MOLD = /mold|mildew|fungi/i;

function homeownersSeeds(loss: LossType): Seed[] {
  const water = loss === "WATER";
  const wind = loss === "WIND";
  const fire = loss === "FIRE";
  const hail = loss === "HAIL";
  const vandal = loss === "VANDALISM";

  const dwelling: Seed = {
    id: "dwelling",
    coverage: "Coverage A",
    title: "Dwelling",
    stance: "pursue",
    keys: ["coverage_a"],
    labels: ["dwelling", "coverage a"],
    endorsement: /ordinance|matching|water backup/i,
    exclusion: water ? /flood|surface water|seepage|leakage|repeated/i : /flood|surface water/i,
    summary: water
      ? "This is where most estimates stop: dry-out, tear-out, drywall, flooring, cabinets, and paint. Build Coverage A completely, then keep going. B, C, and D are separate limits."
      : wind
        ? "Price the roof, openings, and any interior that water entered through a storm-created opening. Interior rain without an opening is the dispute — document the opening."
        : fire
          ? "Structure, smoke, and soot belong on the dwelling. Do not let the carrier stop at a room that looks lightly smoked if the odor and residue continue."
          : hail
            ? "Roof, soft metals, and exterior finishes. Interior damage belongs here only when hail opened the building and water followed."
            : vandal
              ? "Building damage from the break-in or vandalism: doors, windows, walls, and fixtures. Stolen property is not a dwelling item."
              : "Price the building completely under the dwelling limit, then test every other coverage before the estimate goes out.",
    actions: [
      "Scope by room, including access openings the rebuild will need",
      "Keep mitigation separate from reconstruction",
      "Cite the cause so a wear-and-tear or repeated-seepage argument has an answer",
    ],
  };

  const structures: Seed = {
    id: "structures",
    coverage: "Coverage B",
    title: "Other structures",
    stance: hail || wind ? "pursue" : "confirm",
    keys: ["coverage_b"],
    labels: ["other structure", "appurtenant", "coverage b"],
    boost: OTHER,
    summary:
      "Fences, sheds, detached garages, screen enclosures, and pool equipment are a separate limit. They are left at zero on a lot of files that only bill the house.",
    actions: [
      "Walk the lot, not only the house",
      "Photograph any detached structure the loss reached",
      "Price them on their own lines, not inside the dwelling total",
    ],
  };

  const contents: Seed = {
    id: "contents",
    coverage: "Coverage C",
    title: "Personal property",
    stance: fire || vandal ? "pursue" : water ? "confirm" : "hold",
    keys: ["coverage_c"],
    labels: ["personal property", "contents", "coverage c"],
    boost: CONTENTS,
    endorsement: /scheduled|special limit|replacement cost.*content/i,
    exclusion: /business property|property of others/i,
    summary: water
      ? "Furniture, clothing, rugs, electronics, and food in affected rooms are not part of Coverage A. If any of it was damaged, it is a separate claim."
      : wind
        ? "Contents are in play when rain came through an opening the storm made. Inventory what got wet. Do not assume the interior-water dispute kills the contents claim."
        : fire
          ? "Smoke, soot, and odor damage contents well past the burned room. Clothing, soft goods, and electronics are the usual items left off the dwelling estimate."
          : hail
            ? "Contents stay closed unless water entered after hail opened the building. If it did, inventory those rooms."
            : vandal
              ? "Stolen and damaged belongings are a contents claim, with special limits on cash, jewelry, and guns. Do not bury them in the building estimate."
              : "Ask what personal property was damaged. Contents are a separate limit from the building.",
    actions: [
      "Inventory by room with photos before debris leaves",
      "Watch special limits on jewelry, cash, silver, and business property",
      "Track replacement cost and depreciation separately when the form allows it",
    ],
  };

  const ale: Seed = {
    id: "ale",
    coverage: "Coverage D",
    title: "Loss of use",
    stance: fire ? "pursue" : water || wind ? "confirm" : "hold",
    keys: ["coverage_d"],
    labels: ["loss of use", "additional living", "ale", "coverage d", "fair rental"],
    boost: ALE,
    summary: water
      ? "Additional living expense pays when the home, or a real part of it, is not fit to live in. A gutted kitchen, a closed bathroom, or drying equipment running in the house is often enough."
      : fire
        ? "If the insured cannot live there, Coverage D starts at the date of loss and runs until the home is restored. Hotel, meals, laundry, pet boarding, and extra mileage belong here."
        : wind
          ? "Open loss of use when the interior is unlivable, not merely because a roof is tarped. Document which rooms failed and the date they left."
          : "Open loss of use only when the insured actually lost the use of the home. Measure it from that date through restoration.",
    actions: [
      "Record the date they left, or the rooms they lost",
      "Keep hotel, meal, laundry, pet boarding, and mileage receipts",
      "Run the period through restoration, not through the first estimate",
    ],
  };

  const ordinance: Seed = {
    id: "ordinance",
    coverage: "Ordinance or law",
    title: "Code upgrade",
    stance: "confirm",
    keys: ["ordinance_law", "ordinance"],
    labels: ["ordinance", "law or ordinance", "building code"],
    endorsement: /ordinance|law and ordinance|building code/i,
    summary:
      "Tear-out and roof replacement often trigger code the dwelling limit was not priced to cover. Electrical, plumbing, smoke detection, and roof decking are the usual adds.",
    actions: [
      "Ask what current code requires that the old assembly did not",
      "Quote ordinance or law on its own, including the sublimit for undamaged portions",
    ],
  };

  const debris: Seed = {
    id: "debris",
    coverage: "Debris removal",
    title: "Haul-off",
    stance: "confirm",
    keys: ["debris"],
    labels: ["debris"],
    endorsement: /debris removal|tree/i,
    summary: wind || hail
      ? "Tree removal and haul-off are often a limited additional coverage, not an unlimited dwelling line. Get the invoices before the carrier folds them into a low roof number."
      : "Hauling damaged material is often paid in addition to the dwelling limit, or as a percentage above it.",
    actions: [
      "Keep dump tickets and tree invoices",
      "Cite debris removal instead of hiding it inside the dwelling total",
    ],
  };

  const seeds: Seed[] = [dwelling, structures, contents, ale, ordinance, debris];

  if (water || loss === "OTHER") {
    seeds.push(
      {
        id: "mold",
        coverage: "Fungi sublimit",
        title: "Resulting mold",
        stance: "confirm",
        keys: ["mold", "fungi"],
        labels: ["mold", "fungi"],
        boost: MOLD,
        endorsement: /fungi|mold|bacteria/i,
        exclusion: /mold|fungi|bacteria|wet or dry rot/i,
        summary:
          "Mold that follows a covered water loss is often paid up to a sublimit. A fungi exclusion is the usual denial. The cause and the timing decide it.",
        actions: [
          "Document that the mold follows the covered event",
          "Read the sublimit before agreeing it is excluded",
          "Price mold remediation apart from the water rebuild",
        ],
      },
      {
        id: "backup",
        coverage: "Water backup",
        title: "Drain, sewer, or sump",
        stance: "confirm",
        keys: ["water_backup", "backup"],
        labels: ["backup", "sump", "drain"],
        endorsement: /backup|sump|drain|sewer/i,
        exclusion: /backup|sump|drain|sewer/i,
        summary:
          "Water that backs up through a drain or sump is often excluded on the base form and paid only by endorsement. A supply-line break is a different path. Name the source before anyone concedes.",
        actions: [
          "Identify the water source in the file notes",
          "If it is a backup, find the endorsement and its limit",
        ],
      },
      {
        id: "flood",
        coverage: "Flood policy",
        title: "Separate flood contract",
        stance: "hold",
        keys: ["building", "flood_building"],
        labels: ["flood"],
        exclusion: /flood|surface water|storm surge/i,
        summary:
          "Flood, surface water, and storm surge are usually outside the homeowners form. A flood policy has its own building and contents limits. Do not force that water into Coverage A, and do not ignore the flood contract if one exists.",
        actions: [
          "Settle the water source before conceding the homeowners claim",
          "If it is flood, open the flood policy instead of Coverage A",
        ],
      },
      {
        id: "assessment",
        coverage: "Loss assessment",
        title: "Association assessment",
        stance: "hold",
        keys: ["loss_assessment"],
        labels: ["loss assessment", "assessment"],
        endorsement: /loss assessment|association/i,
        summary:
          "On a condo or HOA property, the association can assess the owner for the same loss. That bill is loss-assessment coverage, not Coverage A.",
        actions: [
          "Ask whether an assessment has been levied or is coming",
          "Match it to the endorsement limit",
        ],
      }
    );
  }

  if (wind || hail) {
    seeds.push({
      id: "matching",
      coverage: "Matching",
      title: "Undamaged portions",
      stance: "confirm",
      keys: ["matching"],
      labels: ["matching"],
      endorsement: /matching|pair and set|line of sight/i,
      summary:
        "A repaired slope that does not match the rest of the roof is a common underpayment. Florida matching rules and any matching endorsement decide how much undamaged material has to come with it.",
      actions: [
        "Photograph the mismatch, not only the damaged slope",
        "Cite the matching statute or endorsement in the demand",
      ],
    });
  }

  return seeds;
}

function commercialSeeds(loss: LossType): Seed[] {
  return [
    {
      id: "building",
      coverage: "Building",
      title: "Building",
      stance: "pursue",
      keys: ["building"],
      labels: ["building"],
      summary:
        "The building limit is the commercial equivalent of stopping at Coverage A. Finish the building scope, then open business personal property and business income.",
      actions: [
        "Separate the building from tenant improvements if the form does",
        "Keep mitigation invoices out of the building lump sum",
      ],
    },
    {
      id: "bpp",
      coverage: "Business personal property",
      title: "Contents of the business",
      stance: loss === "HAIL" ? "hold" : "confirm",
      keys: ["bpp"],
      labels: ["business personal", "bpp", "contents"],
      boost: CONTENTS,
      summary:
        "Stock, furniture, equipment, and tenant contents are not the building. A water, fire, or vandalism loss that touched them is a second limit.",
      actions: [
        "Inventory what the business owned in the affected area",
        "Ask who owns tenant improvements versus trade fixtures",
      ],
    },
    {
      id: "income",
      coverage: "Business income",
      title: "Income and extra expense",
      stance: loss === "FIRE" || loss === "WATER" ? "pursue" : "confirm",
      keys: ["business_income"],
      labels: ["business income", "extra expense", "rents"],
      boost: ALE,
      summary:
        "If the operation slowed or closed, business income and extra expense are the money left behind a building-only estimate. Rents follow the same idea for a landlord.",
      actions: [
        "Get the closure dates and the sales the period would have produced",
        "Track extra expense to keep the business running",
      ],
    },
    ...homeownersSeeds(loss).filter((s) => s.id === "ordinance" || s.id === "debris" || s.id === "mold" || s.id === "backup"),
  ];
}

function condoSeeds(loss: LossType): Seed[] {
  return [
    {
      id: "building",
      coverage: "Association building",
      title: "Master building",
      stance: "pursue",
      keys: ["building"],
      labels: ["building"],
      summary:
        "The master policy pays the association's building. Confirm what the master covers versus what the unit owner must claim, so the same damage is not dropped between the two contracts.",
      actions: [
        "Read the association documents for bare-walls versus all-in",
        "Do not assume the master picked up the unit interior",
      ],
    },
    ...homeownersSeeds(loss).filter((s) =>
      ["ordinance", "debris", "income"].includes(s.id) || s.id === "ale"
    ),
    {
      id: "rents",
      coverage: "Rents",
      title: "Business income / rents",
      stance: "confirm",
      keys: ["business_income"],
      labels: ["business income", "rents"],
      summary:
        "Lost rental income on association or unit property is its own coverage. It is not additional living expense and it is not the building limit.",
      actions: ["Ask which units were unrentable and for how long"],
    },
  ];
}

function floodSeeds(): Seed[] {
  return [
    {
      id: "flood-building",
      coverage: "Flood building",
      title: "Building",
      stance: "pursue",
      keys: ["building", "coverage_a"],
      labels: ["building", "dwelling"],
      summary:
        "The flood building limit is separate from any homeowners Coverage A. Price the building against this contract when the water is flood.",
      actions: ["Use the flood form's building definition, not the HO-3 dwelling"],
    },
    {
      id: "flood-contents",
      coverage: "Flood contents",
      title: "Contents",
      stance: "confirm",
      keys: ["contents", "coverage_c"],
      labels: ["contents", "personal property"],
      boost: CONTENTS,
      summary:
        "Flood contents are a separate limit and are often never opened. Inventory damaged property against the flood contents coverage, not Coverage C of the homeowners policy.",
      actions: ["Inventory contents that sat in the flood water", "Confirm the contents limit was purchased"],
    },
    {
      id: "icc",
      coverage: "ICC",
      title: "Increased cost of compliance",
      stance: "confirm",
      keys: ["icc", "ordinance_law"],
      labels: ["compliance", "icc", "ordinance"],
      summary:
        "If the community requires elevation or demolition after a flood, increased cost of compliance can pay toward that work. It is not the building limit.",
      actions: ["Ask whether a substantial-damage determination is coming"],
    },
  ];
}

function seedsFor(frame: PolicyLine, loss: LossType): Seed[] {
  if (frame === "COMMERCIAL_PROPERTY") return commercialSeeds(loss);
  if (frame === "CONDO_MASTER") return condoSeeds(loss);
  if (frame === "FLOOD") return floodSeeds();
  return homeownersSeeds(loss);
}

export function buildCoverageStrategy(
  claim: StrategyClaim,
  applied: boolean
): CoverageStrategy {
  const sources = collectSources(claim);
  const canApply = sources.length > 0;
  const usePolicy = applied && canApply;
  const frame = frameFor(sources, usePolicy);
  const description = claim.lossDescription ?? "";
  const frameSources = sources.filter((s) => s.line === frame);
  const primary = frameSources.find((s) => s.isPrimary) ?? frameSources[0] ?? sources.find((s) => s.isPrimary);

  const plays = seedsFor(frame, claim.lossType).map((seed) =>
    play(seed, description, usePolicy ? attachPolicy(seed, sources, frame) : null)
  );

  if (usePolicy && frame !== "FLOOD") {
    const flood = sources.filter((s) => s.line === "FLOOD");
    if (flood.length) {
      for (const seed of floodSeeds()) {
        plays.push(play(seed, description, attachPolicy(seed, flood, "FLOOD")));
      }
    }
  }

  const propertySources = sources.filter((s) => PROPERTY_LINES.has(s.line));
  const liabilitySources = sources.filter((s) => LIABILITY_LINES.has(s.line));
  const aside = !usePolicy
    ? null
    : propertySources.length === 0 && liabilitySources.length
      ? "The parsed policy is liability. It does not pay the insured's building, contents, or loss of use. The strategy stays on the property coverages."
      : liabilitySources.length
        ? `Also on the file: ${liabilitySources.map((s) => s.label).join("; ")}. That policy does not pay the insured's own building or contents.`
        : null;

  return {
    frame,
    frameLabel: POLICY_LINE_LABELS[frame],
    applied: usePolicy,
    canApply,
    deductible: usePolicy ? primary?.deductibleNotes ?? null : null,
    sources: usePolicy
      ? Array.from(new Set((propertySources.length ? propertySources : sources).map((s) => s.label)))
      : [],
    aside,
    plays,
  };
}

export const STANCE_LABEL: Record<StrategyStance, string> = {
  pursue: "Open this",
  confirm: "Confirm the facts",
  hold: "Only if the facts change",
};
