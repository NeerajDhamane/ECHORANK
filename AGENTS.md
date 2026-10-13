# AGENTS.md — rules for the coding agent (EchoRank)

## What this repo is
EchoRank: a free-tier AI Search Visibility (GEO) tracker. Next.js App Router + SQLite. Specs: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`. Work list: `TASKS.md`. State log: `PROGRESS.md`. Optional reference code (may not exist): `docs/MASTER_BUILD_PLAN.md`.

## Session protocol (every session, no exceptions)
1. Read this file, the last ~40 lines of `PROGRESS.md`, and `TASKS.md`. **Do not read the other docs in full** — open only the section a task points to (use `rg`/`sed -n`).
2. Do **exactly one task**: the one the user names, else the first unchecked task whose dependencies are checked.
3. Implement → `npm run verify` must pass → tick the task in `TASKS.md` → append an entry to `PROGRESS.md` → `git add -A && git commit -m "Txxx: title"`.
4. If blocked, or the spec is wrong/outdated (e.g., an API or model name changed): **stop**, add it to `PROGRESS.md` under `BLOCKERS`, and tell the user. Never silently change scope, stack, or schema.
5. Final message ≤ 10 lines: what changed, how you verified, what is next.

## Commands
```
npm install            npm run dev           npm run verify  (typecheck + lint + test + build)
npm run test           npm run db:migrate    npm run seed    npm run smoke
```

## Stack — fixed, do not swap
Next.js (App Router) · TypeScript strict · Tailwind · SQLite via `better-sqlite3` + Drizzle · zod · jose + bcryptjs · Recharts · lucide-react · Vitest · fonts via `@fontsource/*`.
Do **not** use: Prisma, `next/font/google`, any paid or key-gated-by-payment service, localStorage for auth, global mutable state beyond the DB singleton and scheduler flag.

## Hard rules — security
- Every brand-scoped route calls `getOwnedBrand(brandId, userId)` first; foreign/missing → **404**.
- Validate every request body/query with zod. Parametrised SQL with named params only — never concatenate user input into SQL.
- Any server-side fetch of a user-supplied URL goes through `safeFetch` (blocks private/loopback/link-local, http(s) only, timeout). No exceptions.
- Never log or return secrets, password hashes, or API-key hashes. API keys are shown once.
- Render raw AI answers, scraped titles and user text as **escaped text**. Never `dangerouslySetInnerHTML` with them.
- Escape CSV cells starting with `= + - @`.

## Hard rules — honesty & ethics
- Simulated (mock) data must be stored with `is_simulated=1`, shown with a visible "simulated" badge, and **excluded from headline metrics by default**.
- Show sample size (**n**) wherever a percentage is shown. UI copy says "associated with", never "causes".
- The Discovery module is **read-only**: no code path may post, reply, vote, or message on any external site. No fake accounts, no astroturfing, no paid-link features.
- Don't invent facts about a user's brand in generated briefs; use `[FILL IN]`.
- Never delete or rewrite historical `chats` rows (append-only fact table).

## Hard rules — cost & environment
- Everything must run **free** and **with zero API keys** (simulated providers). Real providers activate only when env keys exist.
- Assume the sandbox may have **no internet**: do not write tests that call real APIs. Live-API checks are the human's job (see `H` tasks).
- Throttle real provider calls (≥ 2.2 s apart), retry 429/503 with exponential backoff, never fail a whole run because one provider failed.

## Code conventions
- TypeScript strict; no `any` unless commented why. Small pure functions in `src/lib/**`, route handlers thin (parse → authorise → call lib → respond).
- Error shape `{ error: string }`; status codes per `docs/ARCHITECTURE.md` §6.
- Timestamps: SQLite default `YYYY-MM-DD HH:MM:SS` UTC. Convert incoming ISO dates with `toSqlTime()`. Never compare mixed formats.
- All metrics come from `src/lib/analytics.ts` (single source of truth). Don't re-implement a metric in a route or component.
- Client components only where interactivity/Recharts needs it (`"use client"`). Data fetching in server components or via the API.
- UI follows `docs/DESIGN.md` tokens; every list/chart has loading, empty, and error states.
- Tests: add/extend unit tests for every new pure function; add a fixture when behavior depends on text.
- Keep diffs small; no drive-by refactors; no new dependencies without a one-line justification in `PROGRESS.md`.

## Environment gotchas (learned the hard way)
- Latest Next.js: route-handler `params` is a **Promise** (`const { id } = await params`); `cookies()` is **async**.
- Tailwind v4 (from `create-next-app` latest) configures theme in CSS (`@import "tailwindcss"` + `@theme inline`), not `tailwind.config.js`. Put design tokens in `src/app/globals.css`.
- Recharts and any hook-using component need `"use client"`.
- `better-sqlite3` is synchronous; don't wrap in async unless needed. Cache the connection on `globalThis` in dev.
- Background processes started in a tool call may die after the call ends; do long-running checks within a single command.
- SQLite `JSON1` functions are available (`json_each`, `json_array_length`).

## Definition of done (every task)
`npm run verify` passes · acceptance bullets in the task are demonstrably met (state how) · `TASKS.md` ticked · `PROGRESS.md` appended · one commit `Txxx: title`.

## Don'ts
Don't read or paste huge files into the chat. Don't regenerate the whole project. Don't change `docs/schema.sql` without a migration note. Don't "fix" failing tests by deleting them. Don't commit `.env`, `*.db`, `node_modules`, `.next`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
