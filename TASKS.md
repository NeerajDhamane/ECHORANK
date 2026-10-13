# PART 5 — TASKS (ordered, small, verifiable)

How to use: tick `[x]` when done and verified. One task per session. `Dep` = must be ticked first. Every task ends with `npm run verify` green + a commit `Txxx: title`. "Ref" points to the doc section to read (read only that section). **Offline-safe:** nothing here may require real API keys to pass verification.

**Priority order if time runs short:** Phases 0 → 1 → 2 → 3 are the MUST slice (a complete product). Then Phase 4/5 (SHOULD), then Phase 6 (COULD). Phase 7 (research) should start by ~day 5 because it generates data while you build.

**Suggested schedule (14 days, adjust freely):** D1 T001–T003 · D2 T004–T006 · D3 T007–T010 · D4 T011–T013 · D5 T014–T015 + start H1/H2 · D6 T016–T017 · D7 T018–T019 · D8 T020–T021, T022 · D9 T023–T025 · D10 T026–T027 · D11 T028–T029 + run H5 · D12 T030–T031, T032–T033 · D13 T034–T037 · D14 T038 + human tasks, buffer.

## Phase 0 — Foundation (M1–M3)
- [x] **T001 Scaffold project** — Dep: none · Ref: ARCHITECTURE §2–3, DESIGN §1
  Do: create Next.js app (TypeScript, Tailwind, ESLint, App Router, `src/`, alias `@/*`, npm) in the repo root (if the scaffolder refuses a non-empty folder, scaffold in a temp dir and move files; keep `docs/`, `AGENTS.md`, `TASKS.md`, `PROGRESS.md`). Install: `better-sqlite3 drizzle-orm jose bcryptjs zod recharts date-fns lucide-react clsx @fontsource/inter @fontsource/space-grotesk @fontsource/jetbrains-mono`; dev: `drizzle-kit @types/better-sqlite3 @types/bcryptjs tsx vitest`. Add scripts: `db:migrate`, `predev`, `prebuild`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `verify` (`typecheck && lint && test && build`), `seed`, `smoke`. `vitest.config.ts` with `@` alias. Add tokens to `globals.css`, import fontsource CSS in `layout.tsx`, `.env.example`, `.gitignore` (`.env*`, `*.db*`). Placeholder landing page.
  Verify: `npm run verify` passes (tests may be a single trivial test); `npm run dev` serves `/`. Commit lockfile.
- [x] **T002 Database layer** — Dep: T001 · Ref: ARCHITECTURE §7, docs/schema.sql
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
