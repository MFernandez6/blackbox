# BLACKSUITE™ — Out-of-Pocket Build Cost Audit

**Prepared for:** Blackline Public Adjusters LLC  
**Principal:** Miguel Fernandez  
**Audit date:** 18 September 2026  
**Scope:** Replacement / out-of-pocket cost to commission the entire BLACKSUITE product family from a third party (contractor or boutique agency), as shipped today  
**Sources of truth:** Public GitHub repositories `blackbox`, `blackgate`, `blackledger`, `blackletter`, `blackmirror` (MFernandez6)

---

## 1. Executive verdict

| Scenario | Estimated out-of-pocket |
|---|---|
| Efficient senior contractor (lean) | **~$250,000** |
| Most likely replacement cost | **~$410,000 – $530,000** |
| Full boutique agency (design + PM + QA + compliance pass) | **~$650,000 – $770,000** |

**Recommended planning number for “what would this have cost to buy”:** **$475,000**  
(midpoint of the most-likely band, rounded)

That figure is **build / replacement cost**, not what was actually spent in cash while the suite was built in-house. It answers: *if Blackline paid an outside firm to deliver the same five apps, integrations, domain rules, and production posture as of this audit, what would the invoice look like?*

Year-one **run cost** (hosting, DB, AI API) is a separate line: roughly **$2,500 – $8,000**, depending on traffic and Anthropic usage.

---

## 2. What “BLACKSUITE” includes

Five production Next.js applications that share brand language, auth patterns, claim identity (`BL-YY-####`), and cross-service APIs:

| Product | Port | Role | Measured production LOC¹ |
|---|---|---|---|
| **BLACKBOX™** | 3000 | Claims CMS — FNOL, workspace tabs, vault, coverage protocol, AI policy parse, ledger/letter/gate APIs | 15,119 |
| **BLACKMIRROR™** | 3001 | Field inspection PWA — offline capture, EXIF/GPS, peril checklist, Claude photo draft, PDF report, vault filing | 9,787 |
| **BLACKGATE™** | 3002 | Intake front door — public/embed/referral forms, staff triage, checklists, webhooks, promote → BLACKBOX | 6,469 |
| **BLACKLETTER™** | 3004 | Contract & letter generation — 19 document types, template versions, merge fields, Google Docs / e-sign, stage map | 6,859 |
| **BLACKLEDGER™** | 3003 | Fee & payout layer — FL PA fee caps, partners, reconciliation, cash-flow, CSV exports, BLACKBOX pull | 5,378 |
| **Suite total** | — | — | **~43,612** |

¹ TypeScript / TSX / Prisma / CSS / SQL under each app, excluding `node_modules` and build artifacts. Counted from current `main` of each repo.

**Not in scope of this dollar estimate (mentioned only as adjacent funnel):** ClaimSaver+ / thePolicyLine marketing sites (separate repos), law-firm practice tools, or a future native mobile App Store binary beyond the BLACKMIRROR PWA.

---

## 3. Inventory that drives cost

### 3.1 Data & domain surface

| Product | Prisma models | Notable domain rules |
|---|---|---|
| BLACKBOX | 14 (+ 11 enums) | Soft-archive only; status always paired with `StatusHistory`; CAT fee 10% vs 20%; multi-line Coverage Protocol; claim number sequence |
| BLACKMIRROR | 20 (shared + inspection) | Offline outbox; adjuster confirmation gate on AI findings; peril indicator library |
| BLACKGATE | 14 | Source-required intake; triage; handoff log; UPL-safe public copy |
| BLACKLETTER | 9 | Template versioning as compliance record; read-only `ClaimMirror` |
| BLACKLEDGER | 10 | Fla. Stat. § 626.854(11) fee caps; claim status writes rejected (405) |

### 3.2 Application surface

| Metric | Suite total |
|---|---|
| App Router pages | ~45 |
| API route handlers | ~40 |
| UI / feature components | ~117 |
| Lib / actions / integration modules | ~130 |
| Git commits across suite (author: MFernandez6) | 75 |
| Calendar window of primary build | ~4 Aug 2026 → ~1 Sep 2026 |

Calendar compression (solo founder, ~4 weeks of intense shipping) is **not** used as the cost basis. Outside firms bill for discovery, design, QA, and rework — not for heroic solo velocity.

### 3.3 Cross-product integration (adds real money)

```
ClaimSaver / PolicyLine / partners
        │ webhooks
        ▼
   BLACKGATE ──promote──► BLACKBOX ◄──photos/vault── BLACKMIRROR
        │                    │  ▲
        │ referral tags      │  │ claim sync / next-doc / executed letters
        ▼                    ▼  │
   BLACKLEDGER ◄──ledger pull──┘
                             │
                        BLACKLETTER
                     (templates, Google Docs,
                      SignWell path, stationery)
```

Service-to-service auth (`Bearer` API keys), dry-run promote modes, and shared Adjuster credentials are part of the delivered system — treat as first-class engineering, not “glue scripts.”

### 3.4 AI & third-party capabilities already wired

- Anthropic Claude for policy parse (BLACKBOX) and field photo draft classification (BLACKMIRROR)
- Supabase Postgres + Storage (shared claims DB / document buckets)
- NextAuth credentials RBAC (`ADMIN` / `ADJUSTER` / `VIEWER` / `FINANCE` where applicable)
- Google Workspace document path + SignWell webhook surface (BLACKLETTER)
- Dexie / IndexedDB offline sync + PWA service worker (BLACKMIRROR)
- Recharts financial dashboard (BLACKLEDGER)
- 19 BLACKLETTER templates spanning intake → close (LOR, PA contract, disclosure, AOB, notice, proof of loss, demand, EUO, appraisal, mediation, releases, closing statement, fee invoice, etc.)

---

## 4. Cost methodology

Three lenses were cross-checked. The **most likely** band is where they agree.

### Lens A — Feature / effort hours × market rates (primary)

Hours reflect what a competent outside team would book to reach **feature parity with today’s code**, including discovery, UI, backend, integrations, seeding, deploy, and a hardening pass — not a greenfield rewrite with different architecture.

| Workstream | Low hrs | Mid hrs | High hrs |
|---|---:|---:|---:|
| BLACKBOX (CMS core) | 400 | 560 | 720 |
| BLACKMIRROR (offline field PWA + AI) | 320 | 440 | 560 |
| BLACKGATE (public + staff intake) | 220 | 300 | 400 |
| BLACKLETTER (19 templates + e-sign path) | 240 | 340 | 440 |
| BLACKLEDGER (fees, payouts, sync) | 180 | 260 | 340 |
| Suite integration / shared design system / DevOps (5 apps) | 120 | 180 | 240 |
| Domain discovery + FL PA / UPL compliance review | 80 | 120 | 160 |
| QA, mobile polish, production hardening | 100 | 160 | 220 |
| **Total engineering hours** | **1,660** | **2,360** | **3,080** |

**Rate assumptions (US, 2026, specialized ops/legal-adjacent SaaS):**

| Buyer path | Blended rate | Notes |
|---|---:|---|
| Senior full-stack contractor | $150 – $200 / hr | Owner-managed; thin PM/design |
| Boutique agency | $180 – $250 / hr | Includes design, light PM, QA |

| Scenario | Hours × rate | Out-of-pocket |
|---|---|---:|
| Lean contractor | 1,660 × $150 | **$249,000** |
| Likely contractor | 2,360 × $175 | **$413,000** |
| Likely agency | 2,360 × $225 | **$531,000** |
| Full agency | 3,080 × $250 | **$770,000** |

### Lens B — All-in dollars per production LOC (sanity check)

Custom vertical business software commonly prices **~$8 – $20 per delivered LOC** all-in once design, QA, and PM are loaded (not “script kiddie” rates).

| Multiplier | 43,612 LOC | Implication |
|---:|---:|---|
| $8 / LOC | ~$349,000 | Efficient contractor shop |
| $12 / LOC | ~$523,000 | Aligns with agency mid |
| $18 / LOC | ~$785,000 | Aligns with full agency high |

### Lens C — Commercial SaaS / platform alternatives (opportunity cost)

Buying “close enough” tools does **not** replicate this suite:

| Alternative path | Rough out-of-pocket | Gap vs BLACKSUITE |
|---|---|---|
| Generic claims CRM (e.g. Filevine-class) | $15k – $60k / yr + implementation | Not PA-specific; no gate/ledger/letter/mirror loop |
| Off-the-shelf PA software + consultants | $25k – $150k year one | Rarely covers offline field AI + fee-cap ledger + 19-letter compliance library |
| Hire agency to clone this architecture | See Lens A | Only true like-for-like |

SaaS subscriptions are **opex**, not a substitute for the capital cost of owning this IP. Ownership value is why the replacement number matters for valuation, insurance, and partnership talks.

---

## 5. Product-level cost allocation

Using the **most likely** mid-hour column at a blended **$200 / hr** (halfway between strong contractor and lean agency):

| Product | Mid hours | Allocated build cost | Share |
|---|---:|---:|---:|
| BLACKBOX™ | 560 | **$112,000** | 24% |
| BLACKMIRROR™ | 440 | **$88,000** | 19% |
| BLACKLETTER™ | 340 | **$68,000** | 14% |
| BLACKGATE™ | 300 | **$60,000** | 13% |
| BLACKLEDGER™ | 260 | **$52,000** | 11% |
| Suite glue / design / DevOps | 180 | **$36,000** | 8% |
| Domain / compliance review | 120 | **$24,000** | 5% |
| QA / hardening | 160 | **$32,000** | 7% |
| **Total** | **2,360** | **$472,000** | 100% |

Rounded planning number: **$475,000**.

---

## 6. Cash already implied by the stack (run cost, not build)

These are **ongoing** out-of-pocket costs to *operate* what was built — not part of the $475k replacement figure, but part of a full TCO view.

| Item | Conservative / mo | Active firm / mo |
|---|---:|---:|
| Vercel (5 projects; Pro-class) | $20 – $100 | $100 – $200 |
| Supabase (Postgres + Storage) | $0 – $25 | $25 – $100 |
| Anthropic API (policy + photo) | $20 – $50 | $100 – $500 |
| Domains / DNS / email | ~$5 | ~$10 |
| Optional e-sign / Google Workspace APIs | $0 – $40 | $40 – $120 |
| **Monthly** | **~$45 – $260** | **~$275 – $930** |
| **Year one ops** | **~$500 – $3,100** | **~$3,300 – $11,000** |

Audit planning band for ops: **$2,500 – $8,000 / year**.

---

## 7. What would *not* be included at the mid estimate

Budget more (push toward the **$650k – $770k** band) if the buyer also required:

- Formal SOC 2 / pen-test / HIPAA-style program (PA firms often skip HIPAA, but carriers and partners may demand security packets)
- Native iOS/Android apps instead of PWA
- Live mailbox sync (BLACKBOX email tab is a log, not IMAP)
- Multi-tenant SaaS packaging for other PA firms (today this is an internal Blackline ops suite)
- Full ClaimSaver+ / thePolicyLine marketing stack rebuild
- Ongoing retainer for feature velocity after handoff

---

## 8. Assumptions & confidence

| Assumption | Impact if wrong |
|---|---|
| Scope = current `main` of the five suite repos | New features after this audit increase cost |
| US blended rates for specialized full-stack | Offshore shops could cut cash 40–60% with higher coordination risk |
| Design system already exists in-repo (forensic BLACKLINE UI) | Greenfield brand work would add $15k – $40k |
| Shared Supabase schema between BOX / MIRROR / GATE is intentional | Re-architecting to separate DBs would add weeks |
| No dedicated mobile/native engineering | PWA accepted as field delivery |
| Legal review of letter templates is light / owner-directed | Outside counsel redlines on 19 templates could add $10k – $40k |

**Confidence:** Medium-high on relative product ranking and order of magnitude; medium on exact midpoint (±20% is a fair uncertainty band → **~$380k – $570k** around the $475k plan number).

---

## 9. Summary table (print this page)

| Question | Answer |
|---|---|
| What was audited? | BLACKBOX + BLACKMIRROR + BLACKGATE + BLACKLETTER + BLACKLEDGER |
| How big is it? | ~43.6k production LOC, ~45 pages, ~40 APIs, 67 Prisma models, 75 commits |
| Lean out-of-pocket build? | **~$250,000** |
| Most likely out-of-pocket build? | **~$410,000 – $530,000** |
| Full agency out-of-pocket build? | **~$650,000 – $770,000** |
| **Recommended replacement value** | **$475,000** |
| Year-one hosting / AI ops | **~$2,500 – $8,000** |
| Implied build + year-one ops | **~$478,000 – $483,000** at the plan number |

---

## 10. Auditor notes

This is an **engineering & commercial replacement audit**, not a formal appraisal for tax, litigation, or GAAP fair-value purposes. For financing or sale of the practice/IP, engage a valuation professional and use this document as the technical schedule of work product.

Repositories measured:

- https://github.com/MFernandez6/blackbox  
- https://github.com/MFernandez6/blackgate  
- https://github.com/MFernandez6/blackledger  
- https://github.com/MFernandez6/blackletter  
- https://github.com/MFernandez6/blackmirror  

*— End of audit —*
