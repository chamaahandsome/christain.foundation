# Christian Foundation (CF)

**A home for sound teaching — and for the people who teach it.**

*In essentials, UNITY. In non-essentials, liberty. In all things, charity.* — Rupertus Meldenius

## Documents

- `PLAN.md` — engineering plan: architecture, data model, port map, build order.
- The concept note (product authority) is maintained outside the repo.

## Stack

Next.js (App Router) · TypeScript · Prisma + MySQL (`relationMode = "prisma"`) · Clerk · Tailwind CSS · Vitest

## Development

```bash
npm install            # also runs prisma generate
cp .env.example .env   # fill in values
npm run dev
```

## Checks

```bash
npm run typecheck      # tsc --noEmit
npm test               # vitest run (tests/)
npm run build          # production build
npx prisma validate    # schema check
```

All four run in CI on every push and pull request. Every piece of pure logic
in `lib/` has a matching test file in `tests/` — keep it that way: new logic
lands with tests in the same commit.

## Layout

- `app/` — routes (App Router)
- `lib/` — domain logic (YouTube embed helpers, scripture refs, doctrinal map
  rules, handle validation)
- `prisma/schema.prisma` — data model (milestone 1: channels, content,
  doctrinal map, pathways, shelves)
- `tests/` — Vitest suites for everything in `lib/`
- `middleware.ts` — Clerk auth for `/studio`, `/admin`, `/settings` (public
  viewer surfaces stay open)
