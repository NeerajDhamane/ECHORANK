# EchoRank — Codex Handoff Pack (PRD + Architecture + Rules + Design + Tasks)

> One document, five parts. Upload this file (or the split bundle) to your coding agent. Everything the agent needs is here; **git is the source of truth** so you can switch accounts or tools at any time without losing state.
>
> Each part is wrapped in HTML-comment markers (BEGIN FILE / END FILE, each followed by the target path) so a script can split the pack into repo files (see Part 0 §3). If you upload the single file, tell the agent to read **Part 3 (AGENTS.md) first**, then only the part relevant to the current task.

| Part | Becomes repo file | Purpose |
|---|---|---|
| 0 | `docs/HANDOFF.md` | How to use this pack, account-switch protocol, prompts |
| 1 | `docs/PRD.md` | What and why: scope, users, metrics, SDG, success criteria |
| 2 | `docs/ARCHITECTURE.md` | How: layers, data flow, interfaces, API contract, security |
| 3 | `AGENTS.md` | Rules the agent must follow every session |
| 4 | `docs/DESIGN.md` | UI design system and page specs |
| 5 | `TASKS.md` | Ordered, small, verifiable tasks |
| 5b | `PROGRESS.md` | Running log (state handoff between sessions/accounts) |
| A | `docs/schema.sql`, `.env.example` | Full SQL schema and env template |

---

<!-- BEGIN FILE: docs/HANDOFF.md -->
# PART 0 — Read Me First (Handoff Protocol)

## 1. Why this pack is built the way it is
- **Free-tier agent budgets are small.** Work is cut into small tasks (one task ≈ one session). The agent should never need to read the whole pack — only `AGENTS.md`, `PROGRESS.md`, `TASKS.md`, and the section a task points to.
- **Accounts/tools can change.** Nothing important lives in a chat. State lives in: git history, `TASKS.md` checkboxes, `PROGRESS.md`, and the docs.
- **The agent's sandbox may have no internet.** Cloud coding agents often restrict network access while working. Verify this for your Codex setup. If it is restricted: install dependencies in the environment setup step (or locally), and **test live APIs (Groq, Gemini, Reddit) yourself on your own machine**, never inside the agent sandbox. All code must work with **zero API keys** (simulated providers) so the agent can verify everything offline.

## 2. One-time setup (you, ~15 minutes)
```bash
mkdir echorank && cd echorank
git init
# put the split bundle files here (AGENTS.md, TASKS.md, PROGRESS.md, docs/…)
# optional deep reference code: copy MASTER_BUILD_PLAN.md to docs/MASTER_BUILD_PLAN.md
git add -A && git commit -m "Add handoff pack"
# create a PRIVATE GitHub repo, then:
git remote add origin <your-repo-url> && git push -u origin main
```
Pin versions: after the first scaffold task, commit `package-lock.json` and **never run `npm update`** (version drift between sessions causes mysterious breakage).

## 3. Splitting this single file into repo files
Save as `split_handoff.py` next to `CODEX_HANDOFF.md` and run `python3 split_handoff.py`:
```python
import re, pathlib
src = pathlib.Path("CODEX_HANDOFF.md").read_text(encoding="utf-8")
# NOTE: the pattern is built with -{2} so this script never matches its own text
PAT = r"<!-{2} BEGIN FILE: ([^\n]+?) -{2}>\n(.*?)<!-{2} END FILE -{2}>"
for m in re.finditer(PAT, src, re.S):
    path, body = m.group(1).strip(), m.group(2).strip("\n")
    lines = body.split("\n")
    if lines and lines[0].startswith("```"):          # strip a wrapping code fence
        lines = lines[1:]
        if lines and lines[-1].startswith("```"): lines = lines[:-1]
    p = pathlib.Path(path); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("\n".join(lines) + "\n", encoding="utf-8"); print("wrote", path)
```

## 4. Session prompts (copy-paste)

**START (normal session):**
> Read `AGENTS.md`, the last 40 lines of `PROGRESS.md`, and `TASKS.md`. Implement ONLY task **T0xx** (or, if I don't name one, the first unchecked task whose dependencies are done). Follow `AGENTS.md` strictly. Run `npm run verify`. Tick the task in `TASKS.md`, append a short entry to `PROGRESS.md`, and commit as `T0xx: <title>`. Finish with a summary of at most 10 lines.

**RESUME (new account / new tool / new machine):**
> This repo is the source of truth; ignore any prior chat. Run `git log --oneline -10`, read `AGENTS.md` and the last 60 lines of `PROGRESS.md`, run `npm install` and `npm run verify`, and report the current state in ≤ 8 lines (what is done, what fails, the next task). Do not change code yet.

**END-OF-DAY (you, 2 minutes):**
```bash
npm run verify && git add -A && git commit -m "wip: <note>" && git push
```
Then paste the last 30 lines of `PROGRESS.md` somewhere safe (notes app) — that alone is enough to resume anywhere.

## 5. Account-switch checklist
1. `git push` everything from the old account. 2. On the new account, clone the repo (or connect it). 3. Create `.env` from `.env.example` (secrets are **never** committed). 4. Run the RESUME prompt. 5. Continue with the next unchecked task.
If you lost the repo but kept this document: re-run §2 and start at T001 — every task is re-creatable from the docs.

## 6. Mapping to Project Review 2 parameters
| Review parameter | Where the evidence comes from |
|---|---|
| SDG / societal / environmental considerations | PRD §9 (design decisions + honest limits) — add a slide using that table |
| Design implementation / prototype | The running app + `docs/DESIGN.md` + screenshots per finished task + `PROGRESS.md` as a build log |
| Individual learning reflection | **Yours to write.** Use `PROGRESS.md` "Learnings" lines as raw material |
| Presentation, documentation, academic integrity | PRD + Architecture + README; disclose AI-assistant use; cite papers you actually verified |
| External engagement / world-of-work | **Human tasks H3–H4 in TASKS.md** (real conversations + screenshots as proof — never fabricated) |

> Review-2 baseline demo: the earlier prototype (`echorank.zip`) is acceptable as "prototype v0"; this build is the full implementation that follows. Label what is done vs planned honestly.
<!-- END FILE -->

---

<!-- BEGIN FILE: docs/PRD.md -->
# PART 1 — Product Requirements Document (PRD): EchoRank

## 1. Summary
EchoRank measures **whether AI assistants mention a brand** when users ask buyer-intent questions, **benchmarks it against competitors**, shows **which websites the AI cites**, and produces **evidence-backed recommendations**. It runs entirely on **free-tier** services and works end to end even with no API keys (clearly-labelled simulated providers).

Category: Generative Engine Optimization (GEO) / Answer Engine Optimization (AEO). Reference products (feature inspiration only — no code, copy, or assets copied): ZeroRank, Otterly.ai, Peec AI, AthenaHQ, CrowdReply.

## 2. Problem
- Users increasingly ask AI assistants for recommendations instead of searching.
- Brands cannot see whether they are mentioned, ranked, described positively, or absent. There is no "Search Console" for AI answers.
- One chat answer is a single noisy, non-deterministic sample, so "just ask ChatGPT" is not a measurement. Measurement needs **repeated, logged sampling over time**.

## 3. Users
| Persona | Need | Success looks like |
|---|---|---|
| **Growth marketer at a small SaaS/DTC brand** | Know if AI recommends them vs competitors; know what to fix | Opens dashboard, sees visibility %, gaps, and 3 prioritised actions |
| **Freelance SEO / agency analyst** | Track several brands, export a client report | Exports a one-page report with honest methodology footer |
| **Evaluator / reviewer (academic)** | Verify the system is real, rigorous, honest | Can trace any number to the raw AI text; sees real-vs-simulated labelled |

## 4. Goals and non-goals
**Goals**
1. A working end-to-end product covering the 26 modules below, ordered by priority.
2. Every metric traceable to stored raw answers (auditability).
3. Every recommendation shows the exact numbers that triggered it.
4. 100% free to run; works offline with simulated providers.
5. Honest research: a small replication experiment reported with confidence intervals and limitations.

**Non-goals (explicitly out of scope)**
Billing/SSO/white-label/agency seats · automated posting to Reddit/Quora · paid backlink marketplace · Google Analytics "AI traffic" integration · true query-fan-out traces · tracking paid platforms (ChatGPT/Claude/Perplexity real APIs) — architecture allows adding them later.

## 5. Feature catalogue (IDs = module numbers)
Priority: **MUST** = core demo slice · **SHOULD** = strong differentiators · **COULD** = if time permits. Build strictly in this order; a partial build must still be a coherent product.

| ID | Feature | Pri | Inspired by | One-line behavior |
|---|---|---|---|---|
| M1 | Auth & sessions | MUST | universal | Sign up/in/out; all data private to the user |
| M2 | Brands & competitors | MUST | ZeroRank/Peec | Track a brand + N competitors (competitors are rows in `brands`) |
| M3 | Prompts, topics, suggestions | MUST | ZeroRank/Otterly | Manage tracked questions grouped by topic; template-based suggestions |
| M4 | Multi-platform AI querying | MUST | all | Provider interface; Groq + Gemini real if keys; simulated fallback (labelled) |
| M5 | Mention detection, rank, orchestrator | MUST | ZeroRank/Peec | Find brands in answers; position = order of first mention; run pipeline |
| M6 | Sentiment | MUST | ZeroRank/AthenaHQ | Keyword-window scoring with negation; optional LLM judge |
| M7 | Citation/source extraction | MUST | ZeroRank/AthenaHQ | Extract domains from answers; classify type |
| M9–13 | Dashboard: visibility trend, sentiment, share of voice, Chats log, Sources view | MUST | ZeroRank/Peec | Charts and tables over the `chats` fact table, with drill-down |
| M14 | Recommendation engine | MUST | ZeroRank/AthenaHQ | Rule-based, evidence JSON, "why this rule?", status workflow |
| M15 | Gap opportunities | SHOULD | ZeroRank | Prompts where rivals appear and you don't |
| M19 | Ranking comparison | SHOULD | ZeroRank | Brand-vs-brand table with Δ vs previous period |
| M20 | Tags | SHOULD | ZeroRank | Tag prompts; filter every view by tag |
| M8 | Content compatibility score | SHOULD | Otterly (GEO audit) | Score text/page on citation-associated features, with fixes |
| M17 | Crawlability checker | SHOULD | Otterly | Lightweight AI-readiness audit with SSRF protection |
| M18 | Content brief generator | SHOULD | Otterly | Brief from a gap; works with no key (template tier) |
| M21 | Report export | SHOULD | ZeroRank/CrowdReply | Print-to-PDF report with methodology footer; CSV export |
| M16 | Discovery feed | SHOULD | CrowdReply (ToS-safe half) | Find public discussions (HN/StackExchange/Reddit); **read-only, never posts** |
| M22 | Alerts + scheduled tracking | COULD | CrowdReply | In-app alerts; cron/endpoint-driven runs |
| M23 | llms.txt / robots.txt generator | COULD | ZeroRank free tools | Generate files; honest about unproven llms.txt adoption |
| M24 | Public visibility checker | COULD | ZeroRank free tool | No-login demo with strict rate limits and caching |
| M25 | Locale tracking (approximate) | COULD | ZeroRank | Locale hint in prompt + filter; labelled approximate |
| M26 | API keys, REST v1, MCP server | COULD | ZeroRank (MCP) | Programmatic access; ownership-checked tools |
| R1 | Research: citation replication experiment | SHOULD | Aşkın & Baykara (2026) design | FAQ vs plain vs statistics-dense; Wilson CIs; honest comparison |
| R2 | Research: before/after case study | COULD | — | Baseline vs post-fix runs with variance; careful causal wording |

## 6. Core user stories and acceptance criteria
1. **Set up:** *As a marketer I add a brand, 3 competitors and 8 prompts in under 3 minutes.* — Suggestions can be added in one click; empty states guide each step.
2. **Measure:** *I click "Run tracking" and see progress.* — Run is async; progress bar from `completed/total`; UI never blocks > 2 s.
3. **Trust:** *I can open any chart's underlying answers.* — Click-through to Chats with filters; brand names highlighted; simulated rows badged.
4. **Compare:** *I see my visibility vs competitors over time.* — Trend lines per brand; tooltip shows n.
5. **Diagnose:** *I see where I lose.* — Gap list sorted by opportunity; minimum-sample guard.
6. **Act:** *I get ≤ 5 prioritised actions with evidence.* — Each shows triggering numbers and rationale; reruns don't duplicate.
7. **Verify a page:** *I paste a draft/URL and get a score with fixes.* — Every failed check has a concrete fix; rescoring shows delta.
8. **Report:** *I export a one-page report.* — KPIs equal dashboard; footer states real vs simulated counts and sample size.
9. **Safety:** *Another user's data is never reachable.* — Cross-user access returns 404; SSRF targets rejected.
10. **Offline demo:** *With no API keys the whole product still demos.* — Simulated data is always labelled and excluded from headline metrics by default.

## 7. Metric definitions (single source of truth — never redefine elsewhere)
| Metric | Definition |
|---|---|
| **Answer (sample)** | One row in `chats` with `error IS NULL` |
| **Visibility %** | answers where brand `mentioned=1` ÷ answers, within scope |
| **Avg. rank** | mean `position` over mentioned answers (lower is better) |
| **Sentiment score (0–100)** | mean of `(sentiment_score+1)/2*100` over mentioned answers |
| **Share of voice** | per brand: answers whose `brands_found` contains it ÷ answers |
| **Gap opportunity** | `rivalRate × (1 − yourRate)` per prompt; dominant rival defines the gap |
| **Scope** | brand + date range + optional platform / prompt / tag / locale + `includeSimulated` (default false) |
Every displayed percentage must be able to show **n** (sample size).

## 8. Success criteria (what "done" means for the project)
1. Demo flow works start to finish in ≤ 5 minutes (script in `TASKS.md` T038).
2. All MUST features pass acceptance; ≥ 6 SHOULD features done.
3. `npm run verify` green; core pure functions covered by tests with fixtures.
4. R1 experiment run with ≥ 300 trials/model, results + limitations written.
5. Documentation: README, PRD, architecture, honest limitations, AI-use disclosure.

## 9. SDG, societal and environmental considerations
Honest framing: these are **design intents and safeguards**, not measured impact claims.

| Area | How the design addresses it |
|---|---|
| **SDG 8 — Decent work & economic growth** | Gives small businesses/entrepreneurs visibility into a new discovery channel previously readable only by well-funded firms; free-tier operation keeps cost near zero |
| **SDG 9 — Industry, innovation & infrastructure** | Open, low-cost tooling and reproducible research (replication experiment, public methodology) for small-business digital capability |
| **SDG 10 — Reduced inequalities** | Evidence in the literature suggests established brands are favoured in AI answers (brand awareness correlates with AI mentions, r≈0.18 in one review); a measurement tool helps smaller brands see and address the gap. We do **not** claim to remove the bias |
| **Environmental (energy use of AI calls)** | Controls built in: caching, per-run prompt caps, small free models, scheduled (not continuous) runs, public-checker daily cap, no polling of AI APIs, simulated mode needs zero model calls |
| **Ethics & integrity** | No auto-posting/astroturfing; no manipulation tactics; simulated data always labelled and excluded from headline metrics; recommendations phrased as "associated with", not "causes"; always show sample size |
| **Privacy** | Store minimum personal data (name, email, hashed password); public checker stores IP + timestamp only for rate limiting; API keys stored hashed; raw AI answers are the user's own tracking data |
| **Fairness of recommendations** | Rules are transparent and evidence-linked; users can see and dismiss every recommendation |
> Verify exact SDG target numbers on un.org before citing a specific target in your slides.

## 10. Risks, assumptions, limitations
- AI answers are non-deterministic → all metrics are estimates; show n.
- Free-tier "platforms" are Llama (Groq) and Gemini, not ChatGPT/Perplexity/Google AI Overviews.
- Plain chat APIs don't fetch live pages or return structured citations → citation yield depends on prompting; label the prompting mode per run.
- Keyword sentiment is crude → report agreement with hand labels.
- Locale tracking is a prompt-level approximation.
- Literature is young and conflicting; rules are "associated with".
- External API terms/limits/model names change → adapters isolated, model names in config.
<!-- END FILE -->

<!-- BEGIN FILE: docs/ARCHITECTURE.md -->
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
<!-- END FILE -->

---

<!-- BEGIN FILE: AGENTS.md -->
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
<!-- END FILE -->

<!-- BEGIN FILE: docs/DESIGN.md -->
# PART 4 — Design System & Page Specs

Original design (do not copy any commercial product's logo, copy, or assets). Mood: calm, technical, evidence-first. Dark navy canvas with one warm **signal-amber** accent. Reports print in light mode.

## 1. Design tokens (put in `src/app/globals.css`)
```css
:root {
  --bg: #0f1420;            --bg-panel: #161c2c;      --bg-panel-hover: #1c2338;
  --border: #262e42;        --text: #edeff5;          --text-muted: #8890a6;
  --signal: #ffb238;        --signal-soft: rgba(255,178,56,.14);   --on-signal: #1a1200;
  --positive: #6fcf97;      --neutral: #8890a6;       --negative: #f2726b;
  --data-blue: #7c9cff;     --focus: #7c9cff;
}
```
Chart palette (competitors, muted): `#7c9cff #6fcf97 #c792ea #5ad1d1 #d1a05a #f2726b #9aa5c4`. **Own brand is always `--signal`, line width 3; competitors 1.5.**
Fonts (self-hosted via `@fontsource`): display **Space Grotesk** 500/600/700 · body **Inter** 400/500/600 · numbers/code **JetBrains Mono** 400/500 (`.tabular` class with `font-variant-numeric: tabular-nums`).

## 2. Scales
- Spacing: 4px base (4, 8, 12, 16, 24, 32, 48). Page gutter 24px; max content width 1200px.
- Radius: 8 (inputs, chips), 12 (cards), 16 (modals). Borders 1px `--border`. No heavy shadows; elevation = lighter panel + border.
- Type: H1 28/600 display · H2 20/600 · H3 16/600 · body 14/400 · small 12/400 muted · KPI number 32/500 mono.
- Motion: 150ms ease for hover/focus; the **signal ping** (pulsing amber dot) is allowed only on "run in progress" and the logo. Respect `prefers-reduced-motion`.

## 3. App shell
- **Top bar (sticky):** logo · **brand switcher** · date range (7d/30d/90d/custom) · platform filter · locale filter · tag filter · **"Include simulated"** toggle (default off) · alerts bell · user menu.
- **Left nav (workspace):** Overview · Prompts · Chats · Sources · Ranking · Gaps · Recommendations · Discovery · Tools (Content score, Crawl audit, Briefs, llms.txt) · Report · Alerts · Settings.
- Filters are URL query params (shareable, survive reload) and apply to every analytic view.
- Mobile (<768px): left nav becomes a drawer; tables scroll horizontally inside their card.

## 4. Components (build once in `components/ui`)
| Component | Spec |
|---|---|
| Button | Primary = amber fill + `--on-signal` text; Secondary = border + panel; Ghost; Danger = `--negative`. Focus ring 2px `--focus`. Loading state shows spinner + disabled |
| Input / Select / Textarea | `--bg` fill, 1px border, focus border `--signal`; label above (12px muted); inline error text `--negative` |
| Card | `--bg-panel`, 1px border, radius 12, padding 20; optional header row (title + actions) |
| Stat card | Label (12 muted) · value (32 mono) · sub-line (delta ▲▼ colored + "n=…") |
| Badge | Neutral chip; **Simulated** = dashed border, muted text; sentiment dots: green/grey/red; priority High/Med/Low; source-type chips |
| Table | Sticky header, row hover `--bg-panel-hover`, sortable columns, empty row state |
| Tabs / Segmented | Underline in `--signal` for active |
| Banner | Info / warning / honesty banner (e.g., "AI answers vary — small samples are directional") |
| EmptyState | Icon + one-sentence explanation + primary action (never a blank chart) |
| Skeleton | Shimmer blocks matching final layout |
| Toast | Bottom-right, auto-dismiss 4s, error toasts persist until closed |
| Modal / Drawer | For API-key reveal ("shown once"), report share links, row details |

## 4b. Charts (Recharts)
Dark gridlines `--border` dashed; axis text `--text-muted` 11px; tooltip = panel + border showing value **and n**; legends clickable to toggle series; every chart wrapped in a Card with title, one-line "what this shows", and an **export CSV** icon. Empty → EmptyState. Colors never carry meaning alone (add labels/patterns for sentiment).

## 5. Page specs
**Landing `/`** — hero ("Does AI recommend your brand?"), 3-step explainer, honest "how it works" (we ask AI repeatedly and log the answers), CTA to sign up, link to public checker. Footer: "Student project · not affiliated with any commercial vendor."

**Auth** — centered card, logo above, inline validation, generic error on bad login.

**Brands `/dashboard`** — grid of brand cards (name, site, last run, latest visibility); "+ Add brand" opens inline form (name, website, industry, aliases); empty state explains the 3 setup steps.

**Overview** — row of 4 stat cards (Visibility %, Avg rank, Positive sentiment %, Answers n) → Visibility trend (line per brand, 7-run moving-average toggle) → two-column: Sentiment donut · Visibility by platform bars → Share-of-voice horizontal bars with "vs you" delta → Top sources table (domain, type, used %, avg citations) → Recent chats (5). **Run tracking** button top-right with progress bar + signal ping while running. Honesty banner when simulated included.

**Prompts** — Tabs Active/Suggested/Inactive; topic groups collapsible with aggregate visibility; per-prompt: text, visibility (— when no runs), sentiment dot, rank, brand chips (+N), locale chip, tag chips; actions: Add prompt, Add topic, Suggest, bulk select, "Run all".

**Chats** — two panes: left searchable list grouped topic → prompt; right timeline for the selected prompt (each run → each platform answer). Answer text with **own brand highlighted amber, rivals muted**, "simulated" badge, sentiment dot, cited domains as chips. Filters: platform, mentioned, sentiment, date. Pagination 50.

**Sources** — Tabs Domains/URLs; donut of domain types + total citations; table with Used %, Avg citations, Type, "cited with"; **Gap analysis** toggle (domains citing rivals but never you).

**Ranking** — table: Brand · Visibility · Δ vs previous period · Sentiment · Avg rank · Mentions; your row badged "You"; optional radar; CSV export.

**Gaps** — table: Prompt · You % · Top rival (+%) · Opportunity bar · actions [Generate brief] [Find discussions]; rows with n<3 greyed "low data".

**Recommendations** — cards grouped by Off-page / On-page / Technical; each: priority badge, title, detail, **Evidence** (key numbers), **"Why this rule?"** expander (rationale + literature note, hedged wording), status control (Todo/In progress/Done/Decline).

**Discovery** — banner: "Read the thread, then reply as yourself if you have something genuinely useful to add." Cards: title, community, score/comments, why-shown, [Open ↗] [Save] [Dismiss]. **No reply/post buttons.**

**Tools** — *Content score:* paste/URL → score ring → passed ✓ list → failed ✗ list with fixes → history with delta. *Crawl audit:* URL → score ring + checklist (detail + fix) → history. *Briefs:* pick prompt → rendered markdown, Copy/Download. *llms.txt:* form left, live preview right, Copy/Download, "verify with Crawl audit" link.

**Report `/dashboard/[id]/report`** — light theme, print CSS: header, KPIs, monthly trend, prompt performance, competitors, sources, gaps, open recommendations, **methodology & limitations footer** (real vs simulated counts, n, date range). "Download PDF" = `window.print()`; "Share link" creates a snapshot.

**Alerts** — list with unread dots, rule settings (type + threshold toggles).
**Settings** — brand details, aliases, auto-track toggle, API keys (create/revoke; key shown once), MCP connect snippets.
**Public checker `/check`** — one centered card (brand, question), result shows "Mentioned in 2 of 3 answers · avg position · tone", answers collapsed, always shows sample size + variability note, CTA to sign up.

## 6. States & copy
Every view has **loading (skeleton) / empty (guidance) / error (retry)**. Copy is plain and specific: "Run tracking to see your first data point." Never "Oops". Numbers show units and n. Use "associated with", "in this sample", "estimated".

## 7. Accessibility
Contrast ≥ 4.5:1 for text; visible focus rings; all controls keyboard-operable; tables use `<th scope>`; charts have text summaries/`aria-label`; no color-only meaning; respect reduced motion; form errors tied to inputs via `aria-describedby`.

## 8. Icons & assets
`lucide-react` only. Logo = amber dot with two concentric rings (the "echo") + wordmark "EchoRank". No stock photos required.
<!-- END FILE -->

<!-- BEGIN FILE: TASKS.md -->
# PART 5 — TASKS (ordered, small, verifiable)

How to use: tick `[x]` when done and verified. One task per session. `Dep` = must be ticked first. Every task ends with `npm run verify` green + a commit `Txxx: title`. "Ref" points to the doc section to read (read only that section). **Offline-safe:** nothing here may require real API keys to pass verification.

**Priority order if time runs short:** Phases 0 → 1 → 2 → 3 are the MUST slice (a complete product). Then Phase 4/5 (SHOULD), then Phase 6 (COULD). Phase 7 (research) should start by ~day 5 because it generates data while you build.

**Suggested schedule (14 days, adjust freely):** D1 T001–T003 · D2 T004–T006 · D3 T007–T010 · D4 T011–T013 · D5 T014–T015 + start H1/H2 · D6 T016–T017 · D7 T018–T019 · D8 T020–T021, T022 · D9 T023–T025 · D10 T026–T027 · D11 T028–T029 + run H5 · D12 T030–T031, T032–T033 · D13 T034–T037 · D14 T038 + human tasks, buffer.

## Phase 0 — Foundation (M1–M3)
- [ ] **T001 Scaffold project** — Dep: none · Ref: ARCHITECTURE §2–3, DESIGN §1
  Do: create Next.js app (TypeScript, Tailwind, ESLint, App Router, `src/`, alias `@/*`, npm) in the repo root (if the scaffolder refuses a non-empty folder, scaffold in a temp dir and move files; keep `docs/`, `AGENTS.md`, `TASKS.md`, `PROGRESS.md`). Install: `better-sqlite3 drizzle-orm jose bcryptjs zod recharts date-fns lucide-react clsx @fontsource/inter @fontsource/space-grotesk @fontsource/jetbrains-mono`; dev: `drizzle-kit @types/better-sqlite3 @types/bcryptjs tsx vitest`. Add scripts: `db:migrate`, `predev`, `prebuild`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `verify` (`typecheck && lint && test && build`), `seed`, `smoke`. `vitest.config.ts` with `@` alias. Add tokens to `globals.css`, import fontsource CSS in `layout.tsx`, `.env.example`, `.gitignore` (`.env*`, `*.db*`). Placeholder landing page.
  Verify: `npm run verify` passes (tests may be a single trivial test); `npm run dev` serves `/`. Commit lockfile.
- [ ] **T002 Database layer** — Dep: T001 · Ref: ARCHITECTURE §7, docs/schema.sql
  Do: `src/db/migrate.ts` executes `docs/schema.sql` idempotently; `src/db/index.ts` singleton (WAL, foreign_keys, `globalThis` cache); `src/db/schema.ts` Drizzle definitions for all tables; `src/lib/time.ts` with `toSqlTime(dateOrIso)`.
  Verify: `npm run db:migrate` twice without error; unit tests: insert/read a user; `toSqlTime("2026-08-30T10:00:00.000Z") === "2026-08-30 10:00:00"`.
- [ ] **T003 Authentication (M1)** — Dep: T002 · Ref: PRD §6 story 9, ARCHITECTURE §8
  Do: `lib/auth.ts`, `lib/require-auth.ts`, `lib/http.ts` (json/error helpers); routes `signup`, `login`, `logout`, `me`; pages `/login`, `/signup`; `dashboard/layout.tsx` server-side guard.
  Verify: tests for hash/verify; smoke: signup→me→logout→me(401); duplicate email 409; unknown-email and wrong-password return the same message; cookie is httpOnly.
- [ ] **T004 UI kit + shell + landing** — Dep: T001 · Ref: DESIGN §3–4, §5 Landing
  Do: `components/ui/*` (Button, Input, Card, Badge, Tabs, Stat, EmptyState, Banner, Skeleton, Toast); workspace layout (`dashboard/[brandId]/layout.tsx`) with top bar + left nav (filters are URL params, not yet functional); real landing page per DESIGN.
  Verify: all nav routes render placeholders; typecheck/lint clean; keyboard focus rings visible.
- [ ] **T005 Brands & competitors (M2)** — Dep: T003, T004 · Ref: ARCHITECTURE §6, PRD §6 stories 1,9
  Do: `lib/brand-access.ts` (`getOwnedBrand`, `getCompetitors`); routes for brands/competitors incl. transactional cascade delete; `/dashboard` brand grid + create form; Settings page with brand details, aliases, competitors list/add/remove.
  Verify: user A cannot read/delete user B's brand (404); deleting a brand leaves zero orphan rows (test counts every table); aliases stored as JSON array.
- [ ] **T006 Prompts, topics, suggestions (M3)** — Dep: T005 · Ref: PRD §5 M3, DESIGN Prompts
  Do: routes (list/create/patch/delete, topics, `?suggest=1`); `lib/prompt-suggestions.ts` (template tiers per intent; fills `{industry}`, `{year}`, `{brand}`, `{competitor}`); Prompts page with tabs Active/Suggested/Inactive, topic groups, add/edit/status toggle, one-click add of suggestions.
  Verify: suggestions never duplicate existing prompts (test); a prompt with no runs shows "—" not "0%".

## Phase 1 — Core loop (M4–M7)
- [ ] **T007 Mention detection (M5a)** — Dep: T002 · Ref: PRD §7
  Do: `lib/analysis/mentions.ts` `detectBrands` — case-insensitive, **lookaround boundaries** (not `\b`), aliases, first-mention index → ascending position.
  Verify (tests): "Try Monday.com or Asana" → Monday.com pos 1; alias counts as same brand; absent brand not returned; punctuation-adjacent names ("(Asana)") match; `C++`-style names don't crash (escaped).
- [ ] **T008 Sentiment (M6)** — Dep: T002
  Do: `lib/analysis/sentiment.ts` `scoreSentiment(text, mentionIndex)` — window −160/+260 chars, positive/negative lexicons, negation flip ("not reliable"), score −1..1 → label thresholds ±0.15.
  Verify (tests): "Acme is not reliable" → negative; "Acme is a top, trusted choice" → positive; neutral text → neutral; no mention → caller stores null.
- [ ] **T009 Citations (M7)** — Dep: T002
  Do: `lib/analysis/citations.ts` (`extractCitations`, `classifyDomain`, `persistSources`); dedupe URL vs bare domain; types review/forum/social/news/reference/docs/own/other.
  Verify (tests): URL + bare mention of same domain counts once; `reddit.com`→forum; `docs.stripe.com`→docs; re-persisting creates no duplicate `sources`.
- [ ] **T010 Providers (M4)** — Dep: T002 · Ref: ARCHITECTURE §5, AGENTS hard rules (cost)
  Do: `lib/providers/{types,mock,groq,gemini,registry,throttle}.ts`, `lib/config.ts` (model names). Mock: seeded by prompt+name+date, sometimes omits the brand, templates mention domains. Registry: real providers only when env keys exist; always adds clearly-labelled simulated platforms. `withRetry` (429/503, exponential backoff) and `sleep`.
  Verify (tests, no network): registry with no env → only mocks with `isMock=true`; `withRetry` retries then succeeds (fake timers) and rethrows non-retryable errors; mock is deterministic for same inputs/day.
- [ ] **T011 Tracking orchestrator + run UI (M5b)** — Dep: T006–T010 · Ref: ARCHITECTURE §4
  Do: `lib/tracking.ts` `runTracking` (fire-and-forget), `POST /api/brands/:id/track`, `GET /api/runs/:id`, `GET /api/brands/:id/runs`; store `brands_found` with per-brand sentiment; failures → error rows and continue; "Run tracking" button with progress bar + signal ping.
  Verify (tests with injected fake providers): one throwing provider doesn't stop others; rows have `locale`, `is_simulated`; `total_expected` correct; with no keys the run completes using mocks.
- [ ] **T012 Seed/demo data** — Dep: T011
  Do: `scripts/seed.ts` (`--reset` supported, idempotent): demo user `demo@echorank.local` / `demo1234`, brand "Acme Cloud" (industry "cloud hosting"), 4 competitors, 10 prompts in 3 topics, 6 runs over the last 14 days with an upward trend — produced **through the real analysis functions**, every row `is_simulated=1`. Print credentials at the end.
  Verify: after seeding, `GET overview?includeSimulated=true` returns ≥ 6 trend points; re-running seed doesn't duplicate.
- [ ] **T013 Smoke test script** — Dep: T011
  Do: `scripts/smoke.ts`: signup → brand → 2 competitors → 3 prompts → run (mocks only) → poll until completed → assert chats exist and overview numbers are consistent.
  Verify: `npm run smoke` exits 0 on a clean DB.

## Phase 2 — Insight (M9–M13)
- [ ] **T014 Analytics service** — Dep: T011 · Ref: PRD §7
  Do: `lib/analytics.ts`: `Scope`, `whereClause` (uses `toSqlTime`, `includeSimulated`, tag/locale/platform/prompt), `visibilityByRun`, `sentimentBreakdown`, `visibilityByPlatform`, `shareOfVoice`, `topSources` — prepared statements with named params.
  Verify (tests with synthetic chat rows): every metric equals hand-calculated values; simulated excluded by default; date filter correct across same-day boundaries.
- [ ] **T015 Overview (M9–M11)** — Dep: T014, T004 · Ref: DESIGN Overview
  Do: `GET /api/brands/:id/overview` + page: stat cards, trend (per-brand lines, own = amber, moving-average toggle, tooltip with n), sentiment donut, platform bars, share-of-voice bars with "vs you" delta, top sources, recent chats; wire top-bar filters to URL params and Scope; chart elements link to filtered Chats.
  Verify: numbers equal hand count of the Chats list for the same filter; empty states for no brand/prompts/runs; honesty banner when simulated included.
- [ ] **T016 Chats log (M12)** — Dep: T015
  Do: list + detail APIs, page with grouped list, per-run/platform timeline, `Highlighted` component (own amber / rivals muted, escaped text), filters, pagination (50), simulated badge.
  Verify: highlight test (component or pure function); filters work; raw HTML in an answer renders as text.
- [ ] **T017 Sources (M13)** — Dep: T015
  Do: sources API + page: Domains/URLs tabs, type donut with total citations, table (Used %, Avg citations, Type, cited-with), **Gap analysis** toggle.
  Verify: Used % = answers citing domain ÷ answers in scope (test); gap toggle lists only domains citing rivals and never you.

## Phase 3 — Diagnosis (M14, M15, M19, M20)
- [ ] **T018 Recommendation engine (M14)** — Dep: T017 · Ref: MASTER_BUILD_PLAN §14 (rule table) if present; else implement R1–R11 below
  Rules: R1 visibility<30% · R2 mentioned-but-uncited ≥50% · R3 negative share>20% · R4 domain cites ≥2 rivals never you · R5 prompt where a rival ≥60% and you 0% · R6 forum domains ≥20% of citations and none yours · R7 visibility fell ≥10 pts over last 2 runs · R8 latest crawl audit score <60 (no-op until T023) · R9 no JSON-LD found (no-op until T023) · R10 avg rank >3 · R11 all healthy.
  Do: `lib/recommendations.ts` (stores `evidence` JSON + `basis` text; dedupes against open recs by rule+subject), API (GET, PATCH status), page grouped Off-page/On-page/Technical with Evidence and "Why this rule?" (hedged wording).
  Verify: one fixture test per rule; rerun doesn't duplicate; `done` hides from default list.
- [ ] **T019 Gap opportunities (M15)** — Dep: T017
  Do: `lib/gaps.ts` (`rivalRate × (1 − yourRate)`, dominant rival), API, page with min-sample guard (n<3 greyed), buttons linking to brief generator and discovery (disabled until those tasks exist).
  Verify: prompt where you're 100% visible never appears; sorted by opportunity.
- [ ] **T020 Ranking (M19)** — Dep: T015
  Do: ranking API + page: visibility, Δ vs equal-length previous window ("n/a" if none), per-brand sentiment (from `brands_found`), avg rank, mentions; CSV export (`lib/csv.ts`, formula-injection safe).
  Verify: Δ uses equal windows (test); CSV escapes `=cmd`.
- [ ] **T021 Tags (M20)** — Dep: T006, T014
  Do: tags API (per-user, case-insensitive unique), chip editor on prompt rows, top-bar tag filter feeding `Scope.tagId` (`prompt_id IN (SELECT prompt_id FROM prompt_tags WHERE tag_id=@tagId)`).
  Verify: tag filter changes Overview, Chats, Sources, Gaps consistently; deleting a tag keeps prompts.

## Phase 4 — Action tools (M8, M17, M18, M23)
- [ ] **T022 Content score (M8)** — Dep: T005
  Do: `lib/analysis/content-features.ts` (`extractFeatures`, `scoreContent`: 9 weighted checks with fixes — FAQ pairs≥3 (20), Flesch≥50 (20), avg sentence ≤22 (10), numericRatio ≤0.06 (10), headings≥3 (10), bullets≥3 (5), JSON-LD (15), words≥300 (5), passive ≤0.25 (5)); API + page (paste/URL, score ring, passed/failed lists, history with delta). URL mode uses `safeFetch` (from T023; until then paste-only).
  Verify (tests): FAQ-style fixture scores higher than a statistics-dense fixture; each failed check returns its `fix`.
- [ ] **T023 Crawlability audit (M17)** — Dep: T005
  Do: `lib/safe-fetch.ts` (`isPrivate`, DNS resolve, http(s) only, timeout, size cap), `lib/crawl-audit.ts` (10 checks: status, speed<1500ms, robots allows AI bots [GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, CCBot], no noindex, content without JS ≥150 words, title+description+canonical, headings, JSON-LD types, sitemap, llms.txt), API, page (score ring, checklist with detail+fix, history). Wording: blocking a bot is a business choice — ask "intentional?", don't scold. **Inject the fetch function** so tests don't touch the network.
  Verify (tests): `http://localhost`, `http://169.254.169.254`, `http://10.0.0.1` rejected; robots parser flags `GPTBot / Disallow: /`; empty `<div id="root">` page fails the no-JS check.
- [ ] **T024 llms.txt / robots.txt generator (M23)** — Dep: T023
  Do: `lib/llms-txt.ts` builders + page (form, live preview, Copy/Download, "verify with Crawl audit"). Copy must not claim llms.txt guarantees citations.
  Verify: generated robots.txt parses with the T023 parser; blocking a bot yields exactly that bot's `Disallow: /`.
- [ ] **T025 Content brief generator (M18)** — Dep: T019, T022
  Do: `lib/briefs.ts`: Tier 1 deterministic skeleton from the prompt + rival snippets + cited domains (no key needed); Tier 2 LLM enrichment only if a real provider key exists (prompt must say "do not invent facts; mark unknown as [FILL IN]"); API, page (markdown render, Copy/Download, "Score my draft" link); wire the Gaps button.
  Verify (tests): no-key path returns a brief naming the actual rival and domains from fixtures.

## Phase 5 — Discovery, reports, alerts (M16, M21, M22)
- [ ] **T026 Discovery feed (M16)** — Dep: T019
  Do: `lib/discovery/{types,hn,stackexchange,reddit,rank}.ts`; `toQuery` (stopword strip, ≤6 keywords); relevance = 0.5·norm(log1p(comments)) + 0.3·norm(log1p(score)) + 0.2·exp(−ageDays/365), ×1.25 if a competitor is named; refresh API (≤10 prompts/refresh, sequential, ≥1s apart, descriptive User-Agent), `UNIQUE(brand_id,url)` upsert; page with Save/Dismiss/Open only. Reddit only if env keys exist; HN + StackExchange need none.
  Verify (tests with mocked fetch): works with no Reddit creds; refresh twice → no duplicates; **no code path performs a non-GET request to an external site except Reddit's token POST**; no reply/post UI exists.
- [ ] **T027 Reports & export (M21)** — Dep: T020, T017, T019, T018
  Do: report page (light theme, print CSS, sections per DESIGN), methodology footer (real vs simulated counts, n, range), CSV export endpoints, share snapshot (`reports` table, unguessable token, stored JSON, revocable) + `/r/[token]`.
  Verify: report KPIs equal Overview KPIs for the same range (test); shared link unchanged after new runs.
- [ ] **T028 Alerts & scheduler (M22)** — Dep: T011, T014
  Do: `lib/alerts.ts` (`visibility_drop`, `competitor_gain`, `negative_sentiment`, `lost_prompt`; minimum sample ≥10 answers; dedupe), alerts API + bell + page + rule settings, `lib/scheduler.ts` (`node-cron` daily, `globalThis` guard) started from `instrumentation.ts`, `POST /api/cron/track` requiring `CRON_SECRET`.
  Verify (tests): synthetic 10-point drop → exactly one alert, re-evaluating adds none; below-min-sample → none; cron endpoint 401 without secret.

## Phase 6 — Extended surface (M25, M24, M26)
- [ ] **T029 Locale tracking (M25)** — Dep: T011
  Do: locale picker per prompt, locale hint in provider call, `chats.locale` stored at run time, locale filter in `Scope`, UI label "locale-hinted (approximate)".
  Verify: editing a prompt's locale never rewrites old chats (test); filter changes all views.
- [ ] **T030 Public checker (M24)** — Dep: T010, T007–T009
  Do: `/check` page + `POST /api/public/check`: per-IP limit (5/hour via `public_check_log`), global daily cap (200), input limits, 24h cache (`public_check_cache`), honeypot field + min-time check, 3 samples from **one** provider, shows sample size and variability; if no keys → loud "demo mode: simulated".
  Verify (tests): 6th request/hour from one IP → 429; cached repeat makes zero provider calls.
- [ ] **T031 API keys, REST v1, MCP (M26)** — Dep: T014, T018, T019
  Do: key creation (`er_` + random; SHA-256 stored; shown once), revoke, `requireApiKeyOrSession`, `/api/v1/*` (brands, overview, prompts, track, runs, chats, sources, gaps, recommendations), `/api/mcp` with `@modelcontextprotocol/sdk` (Streamable HTTP; **verify the SDK's current API in its docs** before coding): tools `list_brands`, `get_overview`, `add_prompt`, `run_tracking`, `get_gap_opportunities`, `get_recommendations`; each tool re-checks ownership; per-key daily cap on `run_tracking`; no delete tools; developer page with connect snippets (verify client syntax in current docs).
  Verify (tests): revoked key → 401; key A can't read user B's brand through any tool; plaintext key never retrievable.

## Phase 7 — Research (R1/R2)
- [ ] **T032 Experiment 1 tooling (R1)** — Dep: T010, T022 · Ref: Aşkın & Baykara (2026) design (small-scale replication)
  Do: `scripts/experiment1/make-versions.ts` (generates plain/faq/stats versions per topic with a provider; or loads hand-written versions), manipulation check via `extractFeatures`, `run.ts` (shuffles source order every repetition, parses `[Source N]` citations, throttled, resumable, writes `research/trials.csv` with model/date/seed), `analyze.ts` (per-version rate + Wilson 95% CI, chi-square goodness-of-fit, position-effect table, per-model, writes `research/results.json` + `research/report.md`; use `jstat` or an equivalent tiny dependency — justify in PROGRESS). Include `fixtures/experiment-sample.csv` for tests.
  Verify (tests): `wilson(50,100)` ≈ 0.404–0.596; analysis of the sample CSV matches hand-computed rates. **Live runs are human task H5.**
- [ ] **T033 Research page (R1)** — Dep: T032
  Do: `/research` page reading `research/results.json`: bar chart (rate ± CI per version per model), table versus the published numbers (FAQ 83.4%, plain 81.1%, statistics-dense 59.3% — GPT-4o, in-context), limitations text; handles missing results gracefully.
  Verify: renders with the sample results; empty state if file absent.

## Phase 8 — Hardening
- [ ] **T034 README & docs** — Dep: T031 — setup from clean clone in ≤ 5 commands, scripts table, env table, architecture summary, honest limitations, "AI-assistant use" disclosure section (fill accurately), screenshots folder placeholder.
- [ ] **T035 Accessibility & responsive pass** — Dep: T027 — walk DESIGN §7 checklist on every page; fix focus, labels, contrast, mobile tables; record findings in PROGRESS.
- [ ] **T036 Security test suite** — Dep: T031 — table-driven tests: every brand-scoped route returns 404 for a non-owner; SSRF matrix; CSV injection; rate-limit tests; no secrets in responses.
- [ ] **T037 Performance & cost pass** — Dep: T036 — verify indexes used (`EXPLAIN QUERY PLAN` on analytics queries), no N+1 in list endpoints, per-run prompt/provider caps, caching of public checker; document in PROGRESS.
- [ ] **T038 Demo script & demo mode** — Dep: T037 — write `docs/DEMO.md`: a 5-minute scripted flow (seed login → overview → chats highlight → sources gap → recommendation evidence → content score before/after → crawl audit → report print → research page), plus fallback steps if the network fails (everything works on seeded/simulated data).

## Human tasks (NOT for the agent)
- [ ] **H1** Create free keys (Groq, Gemini; Reddit optional) → local `.env`; never commit.
- [ ] **H2** Live check on your machine: run one real tracking run; confirm rows with `is_simulated=0`; if a provider returns 404, update the model name in `lib/config.ts` (models change).
- [ ] **H3 External engagement (Review parameter 5):** contact 3–5 real people (digital marketers, SEO freelancers, small-business owners, a hackathon mentor, an industry mentor); demo screenshots/video; ask: (1) Do you check whether AI assistants mention you/your clients? (2) Which metric would you trust/act on? (3) What's missing? (4) Would you use a free tool like this? (5) What worries you (accuracy, cost)? Save proof (screenshots of messages, email, signed note, certificate). **Never fabricate or embellish.**
- [ ] **H4** Add the proof to the report + one paragraph on what you changed because of their feedback (only if true).
- [ ] **H5** Run Experiment 1 locally (≥ 300 trials per model), commit `research/trials.csv` + results; read the limitations honestly.
- [ ] **H6** Hand-label 30 answers (mentioned? sentiment?) into `fixtures/answers.json`; report keyword-sentiment agreement.
- [ ] **H7** Verify every literature reference (title, venue, year, key claim) against the real paper; fix the table. The six later additions were written from summaries, not from the papers.
- [ ] **H8** Write your individual learning reflection in your own words (use PROGRESS "Learnings").
- [ ] **H9** Update slides: SDG slide (PRD §9), architecture, real screenshots, honest done-vs-planned.
- [ ] **H10** Push to the private GitHub repo daily; back up `.env` separately (password manager).
<!-- END FILE -->

---

<!-- BEGIN FILE: PROGRESS.md -->
# PROGRESS.md — build log (append only; newest at bottom)

Format per entry:
```
## YYYY-MM-DD  Txxx  <title>   [done | partial | blocked]
- Changed: <files/areas, 1–3 bullets>
- Verified: <commands run + result>
- Decisions/deviations: <or "none">
- Learnings: <one line, useful for the individual reflection>
- Next: <task id>
```

## BLOCKERS
(none)

## Log
(empty — first entry is created by T001)
<!-- END FILE -->


---

# APPENDIX A — Files referenced above

<!-- BEGIN FILE: docs/schema.sql -->
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  owner_brand_id TEXT,              -- NULL = tracked brand; else competitor of that brand
  name TEXT NOT NULL,
  aliases TEXT DEFAULT '[]',        -- JSON array of alternate names for mention detection
  website TEXT,
  industry TEXT,
  auto_track INTEGER NOT NULL DEFAULT 0,      -- Module 22: scheduled tracking on/off
  track_frequency TEXT DEFAULT 'daily',       -- Module 22: daily | weekly
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  topic_id TEXT,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',   -- active | suggested | inactive
  locale TEXT DEFAULT 'global',            -- Module 25
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (prompt_id, tag_id)
);

CREATE TABLE IF NOT EXISTS tracking_runs (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',  -- running | completed | failed
  trigger TEXT DEFAULT 'manual',           -- manual | scheduled
  label TEXT,                              -- optional: 'baseline' | 'post-fix' for the case study
  total_expected INTEGER NOT NULL DEFAULT 0 -- prompts x providers, for progress bars
);

-- Atomic fact table: one row per (run x prompt x platform). APPEND-ONLY.
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  brand_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  locale TEXT DEFAULT 'global',            -- Module 25: copied from the prompt at run time (chats are immutable)
  is_simulated INTEGER NOT NULL DEFAULT 0,
  raw_response TEXT,
  mentioned INTEGER NOT NULL DEFAULT 0,
  position INTEGER,                        -- 1-based rank among all brands found; NULL if absent
  sentiment TEXT,                          -- positive | neutral | negative
  sentiment_score REAL,                    -- -1..1
  brands_found TEXT DEFAULT '[]',          -- JSON [{brandId,name,position,sentiment,sentimentScore}] (competitor sentiment needed by Module 19)
  cited_sources TEXT DEFAULT '[]',         -- JSON array of normalized domains
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'other'       -- review|docs|forum|news|social|corporate|other
);

CREATE TABLE IF NOT EXISTS chat_sources (
  chat_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  citation_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (chat_id, source_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  run_id TEXT,
  category TEXT NOT NULL,                  -- content | authority | technical
  priority TEXT NOT NULL,                  -- high | medium | low
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  evidence TEXT,                           -- JSON: the exact numbers that triggered the rule
  basis TEXT,                              -- short literature/rationale note shown under "Why this rule?" 
  status TEXT NOT NULL DEFAULT 'open',     -- open | in_progress | done
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discovery_items (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  prompt_id TEXT,
  platform TEXT NOT NULL DEFAULT 'reddit',
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  subreddit TEXT,
  score INTEGER DEFAULT 0,
  num_comments INTEGER DEFAULT 0,
  relevance REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',      -- new | saved | dismissed
  found_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_id, url)
);

CREATE TABLE IF NOT EXISTS crawl_audits (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  url TEXT NOT NULL,
  result TEXT NOT NULL,                    -- JSON of every check
  score INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_scores (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  label TEXT,
  content TEXT NOT NULL,
  features TEXT NOT NULL,                  -- JSON of computed NLP features
  score INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_briefs (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  prompt_id TEXT,
  brief TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  type TEXT NOT NULL,                      -- visibility_drop | competitor_gain | negative_sentiment | lost_prompt
  threshold REAL NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  rule_id TEXT,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,              -- Module 21: unguessable share token
  snapshot TEXT NOT NULL,                  -- JSON snapshot of report data (never live-queried)
  date_from TEXT, date_to TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public_check_cache (
  cache_key TEXT PRIMARY KEY,              -- Module 24: hash(brand|question)
  result TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public_check_log (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  last_used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brands_user ON brands(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_owner ON brands(owner_brand_id);
CREATE INDEX IF NOT EXISTS idx_prompts_brand ON prompts(brand_id);
CREATE INDEX IF NOT EXISTS idx_runs_brand ON tracking_runs(brand_id);
CREATE INDEX IF NOT EXISTS idx_chats_run ON chats(run_id);
CREATE INDEX IF NOT EXISTS idx_chats_brand ON chats(brand_id);
CREATE INDEX IF NOT EXISTS idx_chats_prompt ON chats(prompt_id);
CREATE INDEX IF NOT EXISTS idx_recs_brand ON recommendations(brand_id);
CREATE INDEX IF NOT EXISTS idx_discovery_brand ON discovery_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_alerts_brand ON alerts(brand_id);
CREATE INDEX IF NOT EXISTS idx_pubcheck_ip ON public_check_log(ip, created_at);
```
<!-- END FILE -->

<!-- BEGIN FILE: .env.example -->
```
# EchoRank environment (copy to .env — NEVER commit .env)
AUTH_SECRET=replace-with-a-long-random-string
DATABASE_PATH=./echorank.db

# Optional real providers (free tiers). Everything works without them (simulated, labelled).
GROQ_API_KEY=
GEMINI_API_KEY=

# Optional discovery source (HN + StackExchange need no key)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=

# Optional: protects POST /api/cron/track
CRON_SECRET=

# Optional: email alerts (in-app alerts work without it)
RESEND_API_KEY=
```
<!-- END FILE -->

*— End of Handoff Pack —*
