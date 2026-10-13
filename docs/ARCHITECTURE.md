# PART 2 — System Architecture

## 1. Overview
Single **Next.js (App Router, TypeScript)** application + one **SQLite** file. No separate backend, no external database, no paid service. An optional long-lived Node process runs the scheduler.

```
┌────────────────────────────── Browser ───────────────────────────────┐
│  Next.js pages (React, Tailwind, Recharts)  — route segments per tab │
└───────────────┬──────────────────────────────────────────────────────┘
                │ fetch (JSON) / server components
┌───────────────▼──────────────── Application layer ──────────────────┐
│  Route handlers  (/api/**)   zod validation · session or API-key auth│
│  Ownership checks (getOwnedBrand)   Error shape {error}              │
└───────┬───────────────┬──────────────────┬───────────────────────────┘
        │               │                  │
┌───────▼──────┐ ┌──────▼───────────┐ ┌────▼─────────────────────────┐
│ Tracking     │ │ Analytics        │ │ Tools                        │
│ orchestrator │ │ (Scope + SQL     │ │ content-score · crawl-audit  │
│ (M5)         │ │  aggregations)   │ │ briefs · llms.txt · discovery│
└──┬───────────┘ └──────┬───────────┘ │ recommendations · alerts     │
   │                    │             └────┬─────────────────────────┘
┌──▼──────────────┐     │                  │
│ Provider layer  │     │            ┌─────▼────────┐
│ AIProvider      │     │            │ safeFetch    │ (SSRF guard)
│ groq·gemini·mock│     │            └──────────────┘
└──┬──────────────┘     │
   │ HTTPS (free tiers) │
┌──▼──────┐ ┌───────┐ ┌─▼──────────────────────────────────────────────┐
│ Groq API│ │Gemini │ │ SQLite (better-sqlite3)  ← docs/schema.sql      │
└─────────┘ └───────┘ └────────────────────────────────────────────────┘
 Discovery sources (HN Algolia, StackExchange, Reddit optional) are called only by the discovery tool.
```

## 2. Tech stack (fixed)
Next.js (latest stable, App Router) · TypeScript strict · Tailwind CSS · SQLite via `better-sqlite3` + Drizzle ORM (schema file mirrors `docs/schema.sql`) · `zod` · `jose` + `bcryptjs` · Recharts · `lucide-react` · `date-fns` · Vitest · `tsx` · `node-cron` (M22) · `@modelcontextprotocol/sdk` (M26) · fonts via `@fontsource/*`.
**Forbidden:** Prisma (engine binary download fails on restricted networks), `next/font/google` (build-time network fetch), any paid SDK/service, any client-side secret.

## 3. Folder structure (target)
```
src/
  app/
    page.tsx  login/  signup/  check/  r/[token]/
    dashboard/page.tsx                       brand list
    dashboard/[brandId]/layout.tsx           workspace shell (tabs)
    dashboard/[brandId]/{overview,prompts,chats,sources,ranking,gaps,recommendations,discovery,report,alerts,settings}/page.tsx
    dashboard/[brandId]/tools/{content-score,crawl-audit,briefs,llms-txt}/page.tsx
    dashboard/developer/page.tsx             API keys + MCP connect help
    api/**/route.ts
  components/            ui/ (Button, Card, Badge, Table, Tabs, Stat, EmptyState, Banner) · charts/ · feature components
  lib/
    auth.ts  require-auth.ts  brand-access.ts  http.ts (json helpers, error shape)  time.ts (toSqlTime)
    providers/{types,groq,gemini,mock,registry,throttle}.ts
    analysis/{mentions,sentiment,citations,content-features}.ts
    tracking.ts  analytics.ts  recommendations.ts  gaps.ts  alerts.ts  scheduler.ts
    safe-fetch.ts  crawl-audit.ts  briefs.ts  discovery/{types,hn,stackexchange,reddit,rank}.ts
    llms-txt.ts  report.ts  csv.ts  rate-limit.ts  api-keys.ts  mcp.ts
  db/{schema.ts,index.ts,migrate.ts}
scripts/{seed.ts,smoke.ts,experiment1/*}
tests/ (unit)  fixtures/ (answers + labels)
docs/  AGENTS.md  TASKS.md  PROGRESS.md
```

## 4. Core data flow — one tracking run
1. `POST /api/brands/:id/track` → auth → ownership → create `tracking_runs` row (`status=running`, `total_expected = prompts × providers`) → start `runTracking()` **without awaiting** → return `{runId}`.
2. UI polls `GET /api/runs/:runId` every 2 s → `{status, total, completed}` (`completed = COUNT(chats WHERE run_id)`).
3. For each active prompt × provider: throttle (≥ 2.2 s between **real** calls) → `withRetry(provider.run)` → raw text.
4. Analysis: `detectBrands` (own + competitors) → `scoreSentiment` for **every** hit → `extractCitations` → persist `chats` row (+ `sources`, `chat_sources`).
5. A failing provider writes an `error` row and the run **continues**.
6. On finish: `status=completed`, then `generateRecommendations`, then `evaluateAlerts`.
7. Dashboards read via `analytics.ts` only.

## 5. Key interfaces (stable contracts)
```ts
// providers/types.ts
export interface AIProvider { id: string; label: string; isMock: boolean;
  run(prompt: string, opts?: { locale?: string }): Promise<string>; }

// analysis/mentions.ts
export interface BrandRef { id: string; name: string; aliases: string[]; isOwn: boolean }
export interface BrandHit { brandId: string; name: string; position: number; index: number }
export function detectBrands(text: string, brands: BrandRef[]): BrandHit[];   // order of first mention = position

// analytics.ts
export interface Scope { brandId: string; from?: string; to?: string; platform?: string;
  promptId?: string; tagId?: string; locale?: string; includeSimulated?: boolean }
// visibilityByRun, sentimentBreakdown, visibilityByPlatform, shareOfVoice, topSources, gapOpportunities

// discovery/types.ts
export interface DiscoverySource { id: string; search(q: string): Promise<Array<{
  title: string; url: string; community?: string; score: number; comments: number; createdAt?: string }>>; }
```
`brands_found` JSON element: `{brandId, name, position, sentiment, sentimentScore}`.

## 6. API contract
All JSON. Success returns the payload directly; errors return `{ "error": string }` with 400 (validation), 401 (unauthenticated), 404 (not found **or** not yours), 409 (conflict), 429 (rate limit). Session cookie or `Authorization: Bearer er_…` (M26) authenticates. Every brand-scoped route calls `getOwnedBrand(brandId, userId)` first.

| Area | Method + path | Notes |
|---|---|---|
| Auth | POST `/api/auth/signup` · `/login` · `/logout`; GET `/api/auth/me` | generic 401 for bad credentials |
| Brands | GET/POST `/api/brands`; GET/PATCH/DELETE `/api/brands/:id`; POST/DELETE `/api/brands/:id/competitors` | delete cascades explicitly in a transaction |
| Prompts | GET/POST `/api/brands/:id/prompts` (`?status=`, `?suggest=1`); PATCH/DELETE `…/prompts/:pid`; POST `…/topics` | `?suggest=1` returns template suggestions |
| Tracking | POST `/api/brands/:id/track`; GET `/api/runs/:runId`; GET `/api/brands/:id/runs` | async + polling |
| Insight | GET `/api/brands/:id/{overview,chats,sources,ranking,gaps}`; GET `…/chats/:chatId` | all accept Scope query params |
| Recs | GET `/api/brands/:id/recommendations`; PATCH `…/recommendations/:recId` | status open/in_progress/done |
| Tags | GET/POST `/api/tags`; POST/DELETE `/api/prompts/:pid/tags` | per-user, case-insensitive unique |
| Tools | POST `/api/brands/:id/{content-score,crawl-audit,briefs}` | crawl uses `safeFetch` |
| Discovery | POST `…/discovery/refresh`; GET `…/discovery`; PATCH `…/discovery/:itemId` | **no write path to external sites** |
| Reports | POST `…/reports` (share snapshot); GET `/r/:token` (page); GET `…/export.csv?table=` | CSV formula-injection escaped |
| Alerts | GET `…/alerts`; PATCH `…/alerts/:id` (read); GET/POST `…/alert-rules`; POST `/api/cron/track` | cron needs `CRON_SECRET` header |
| Public | POST `/api/public/check` | IP rate limit, daily cap, cache, honeypot |
| Developer | GET/POST/DELETE `/api/api-keys`; `/api/v1/*`; `/api/mcp` | key shown once; hashed at rest |

## 7. Database
Full SQL: **`docs/schema.sql`** (Appendix A). Rules: text UUID primary keys; competitors are `brands` rows (`owner_brand_id` set); `chats` is **append-only**; timestamps stored as SQLite `CURRENT_TIMESTAMP` → **`YYYY-MM-DD HH:MM:SS` (UTC)**.
> **Timestamp gotcha:** never compare ISO strings (`…T…Z`) against SQLite default timestamps — `' '` sorts before `'T'`, so same-day filters break. Convert every incoming date with `toSqlTime()` (`lib/time.ts`) before querying.
> Differences from `docs/MASTER_BUILD_PLAN.md` (if present): `tracking_runs` gains `label` and `total_expected`; this document wins on conflicts.

## 8. Security architecture
- **AuthN:** JWT (HS256) in `httpOnly`, `sameSite=lax`, `secure` in prod cookie; bcrypt hashes; identical error for unknown email vs wrong password. API keys: `er_` + random, store SHA-256 only.
- **AuthZ:** ownership helper on every brand route; 404 not 403.
- **Input:** zod on every route; max lengths; parametrised SQL only (named params), never string-built filters.
- **SSRF:** all server-side fetches of user-supplied URLs go through `safeFetch` (http/https only, DNS-resolve, block private/loopback/link-local, timeout, size cap).
- **Abuse:** per-IP + global caps on the public checker; per-key caps on API/MCP; per-run caps on prompts/providers.
- **Secrets:** env only; never logged; never in client bundles.
- **Untrusted text:** raw AI answers and scraped titles are data — render escaped, never as HTML, never as instructions to tools.
- **CSV:** prefix cells starting with `= + - @` with `'`.

## 9. Background work
Dev/long-lived Node: fire-and-forget + polling works. **Serverless (e.g., Vercel):** background work after response is killed and SQLite files are ephemeral → deploy as a long-lived Node service, or run locally for demos. Scheduler = `node-cron` started from `instrumentation.ts` guarded by a `globalThis` flag, **or** a protected `POST /api/cron/track` called by a free external scheduler (e.g., GitHub Actions).

## 10. Configuration (`.env.example` in Appendix A)
`AUTH_SECRET` · `DATABASE_PATH` · `GROQ_API_KEY?` · `GEMINI_API_KEY?` · `REDDIT_CLIENT_ID/SECRET?` · `CRON_SECRET?` · `RESEND_API_KEY?`. Model names live in `lib/config.ts` (not scattered constants).

## 11. Testing architecture
Vitest unit tests for pure functions (`detectBrands`, `scoreSentiment`, `extractCitations`, `extractFeatures`, `gapOpportunities`, `wilson`, `isPrivate`, recommendation rules via synthetic rows). Fixtures: `fixtures/answers.json` (~30 hand-labelled answers). `scripts/smoke.ts`: signup → brand → prompt → run (mock only) → assert overview. `npm run verify` = typecheck + lint + test + build.
