# BLACKBOX

Internal claims management system for **Blackline Public Adjusters LLC**.  
Ops tool for adjusters and staff — not client-facing.

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
| `diana.reyes@blacklineadjusting.com` | ADMIN |
| `marcus.chen@blacklineadjusting.com` | ADJUSTER |
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

## Contingency fee rule

- Standard claims: **20%**
- CAT claims (`isCatClaim = true`): **10%** (FL PA fee cap on declared catastrophe losses)

Applied on FNOL create and when toggling CAT on the claim detail.

## Claim numbers

Format `BB-YYYY-####`, sequential per calendar year via `ClaimNumberSequence` (transaction-safe upsert + increment). Never random.

## Status changes

`Claim.status` must never be updated alone. `changeClaimStatusAction` writes `StatusHistory` in the same Prisma transaction. Archiving sets `isArchived` only — documents, payments, and history are retained.

## Roles

| Role | Access |
|---|---|
| ADMIN | Full edit + payment log + all claims |
| ADJUSTER | Edit own/assigned claims; no payment log |
| VIEWER | Read-only; edit controls hidden |

## AI_HOOK placeholders (do not wire APIs yet)

This phase is CMS core only. Intentionally unused:

1. **`Document.extractedData` / `extractionStatus`** — schema fields reserved for future extraction.
2. **Upload handler** (`src/app/api/upload/route.ts` + `registerDocumentAction`) — comment:
   `// AI_HOOK: after upload, call extraction service and populate Document.extractedData + set extractionStatus`
3. **Claim detail document list** — comment:
   `// AI_HOOK: display extractedData fields here once populated (policy number, date of loss, claimant name cross-check)`

## Visual language

Matches blacklineadjusting.com internal tone:

- Background `#0A0A0A`, text `#F5F5F0`, hairlines `#2A2A2A`
- Border radius `0` (overrides soft shadcn defaults)
- JetBrains Mono for eyebrows / claim numbers / badges; Inter for body; Libre Baskerville for display
- Accent `#8B0000` for DENIED / destructive only
- Copy tone: forensic / legal authority — no friendly SaaS fluff
# blackbox
