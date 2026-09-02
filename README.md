# BLACKBOX™

Internal claims management system operated for **Blackline Public Adjusters LLC**.  
Ops tool for adjusters and staff — not client-facing. Owner / principal: Miguel Fernandez.

## Stack

- Next.js 14 (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn-style primitives (sharp corners, forensic dark theme)
- **Prisma → Supabase Postgres** (pooled runtime URL + direct URL for migrations)
- NextAuth Credentials (roles: `ADMIN` | `ADJUSTER` | `VIEWER`)
- Zod + React Hook Form
- date-fns, sonner

## Supabase setup

1. Project already wired for client SDK (`@supabase/supabase-js` + `@supabase/ssr`).
   Helpers: `src/lib/supabase/{client,server,middleware}.ts`
2. `.env.local` must include:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (server uploads on Vercel) |
| `DATABASE_URL` | Database → Connection pooling (Transaction, port `6543`, `?pgbouncer=true`) |
| `DIRECT_URL` | Database → Direct connection (port `5432`) |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | Local auth (v1 still uses NextAuth + `Adjuster` table) |

Keep `.env` in sync with `.env.local` — Prisma CLI only reads `.env`.

3. Apply schema + seed:

```bash
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seeded credentials

All seed adjusters share password: `Password123!`

| Email | Role |
|---|---|
| `miguel.fernandez@blacklineadjusting.com` | ADMIN (owner / principal adjuster) |
| `diana.reyes@blacklineadjusting.com` | ADMIN |
| `marcus.chen@blacklineadjusting.com` | ADJUSTER |
| `frankie@blacklineadjusting.com` | ADJUSTER |
| `sofia.alvarez@blacklineadjusting.com` | VIEWER |

## Migrations & seed

```bash
# Create / apply migrations (uses DIRECT_URL)
npx prisma migrate dev

# Push schema without migration history (prototyping only)
npx prisma db push

# Seed sample adjusters + claims
npm run db:seed
```

Seed config lives in `package.json` → `prisma.seed`.

## AI policy extraction

Coverage Protocol **Parse Policy** uses Anthropic when `ANTHROPIC_API_KEY` is set (local `.env` / Vercel). Without a key, enter Coverage A–D manually. Optional: `ANTHROPIC_POLICY_MODEL`.

## Contingency fee rule

- Standard claims: **20%**
- CAT claims (`isCatClaim = true`): **10%** (FL PA fee cap on declared catastrophe losses)

Applied on FNOL create and when toggling CAT on the claim detail.

## Claim numbers

Format `BL-YY-####` (e.g. `BL-26-0005`), sequential per calendar year via `ClaimNumberSequence` (transaction-safe upsert + increment). Never random.

## Status changes

`Claim.status` must never be updated alone. `changeClaimStatusAction` writes `StatusHistory` in the same Prisma transaction. Archiving sets `isArchived` only — documents, payments, and history are retained.

## Roles

| Role | Access |
|---|---|
| ADMIN | Full edit + payment log + all claims |
| ADJUSTER | Edit own/assigned claims; no payment log |
| VIEWER | Read-only; edit controls hidden |

## AI_HOOK / extraction

Policy parse is wired to Anthropic (`src/lib/policy-ai.ts`). Document list may still show extraction status badges; cross-check UI for extractedData remains light until payloads are routinely populated.

## BLACKGATE intake

Intake lives in [BLACKGATE](../blackgate) (port 3002). BLACKBOX no longer has a staff intake tab.

- New files appear on the Files dashboard after BLACKGATE promote — there is no Gate / intake tab in BLACKBOX.
- BLACKGATE promote calls `POST /api/claims/intake` with `Authorization: Bearer $BLACKBOX_API_KEY`.
- Collected files follow on `POST /api/claims/intake/documents`.
- Promoted files keep `sourceIntakeNumber` / `sourceIntakeId` and link back to the original gate record.

On BLACKGATE, set the same `BLACKBOX_API_KEY` and turn `BLACKBOX_DRY_RUN` off so promote writes a live claim instead of a simulated `BL-YY-####`.

## BLACKLEDGER export

`GET /api/ledger/claims` is a read-only financial snapshot for BLACKLEDGER (port 3003). Authenticate with a staff session or `Authorization: Bearer $BLACKLEDGER_API_KEY`. Writes are rejected (405). Claim status cannot be changed from that route.

## Visual language

Matches blacklineadjusting.com internal tone:

- Background `#0A0A0A`, text `#F5F5F0`, hairlines `#2A2A2A`
- Border radius `0` (overrides soft shadcn defaults)
- JetBrains Mono for eyebrows / claim numbers / badges; Inter for body; Libre Baskerville for display
- Accent `#8B0000` for DENIED / destructive only
- Copy tone: forensic / legal authority — no friendly SaaS fluff
# blackbox
