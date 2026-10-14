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
## 2026-10-14  T001  Scaffold project   [done]
- Changed: Next.js App Router scaffold in `src/`, EchoRank landing placeholder and design tokens, self-hosted fontsource imports, app dependencies, scripts, Vitest config, and `.gitignore`.
- Verified: `npm run verify` passed (typecheck, lint, test, build); `node -v` = `v24.20.0`; `better-sqlite3` loaded and returned `1` from an in-memory query.
- Decisions/deviations: Continued on Node 24 at the user's direction; `db:migrate` is a placeholder until T002. Added `@tailwindcss/turbopack` because the generated Next config requires its CSS loader.
- Learnings: `better-sqlite3` installed and loaded successfully on this Node 24 environment.
- Next: T002

## 2026-10-14  T002  Database layer   [done]
- Changed: Added the idempotent SQL migration runner, WAL/foreign-key SQLite singleton, Drizzle definitions for all schema tables, and UTC timestamp conversion.
- Verified: `npm run db:migrate` succeeded twice; `npm run verify` passed (typecheck, lint, 3 tests, production build). Test covers repeated migration, user insert/read, and the requested ISO-to-SQL timestamp conversion.
- Decisions/deviations: none; `docs/schema.sql` remains the source of truth.
- Learnings: SQLite DDL in the handoff schema is safe to apply repeatedly inside a transaction.
- Next: T003
## 2026-10-14  T003  Authentication   [done]
- Changed: Added signup/login/logout/me APIs, bcrypt password handling, HS256 httpOnly sessions, authenticated dashboard guard, and login/signup pages.
- Verified: `npm run verify` passed; HTTP smoke covered signup, login, logout, `/me`, duplicate signup (409), identical 401 credential errors, HttpOnly cookie, and dashboard redirect/access; password hashing and session tests pass.
- Decisions/deviations: Kept the dashboard guard request-time rendered with `instant = false` for the installed Next.js Cache Components mode; included Next.js generated agent guidance in `AGENTS.md` as directed there.
- Learnings: bcrypt compares at most 72 password bytes, so request validation rejects longer UTF-8 inputs before hashing.
- Next: T004
## 2026-10-14  T004  UI kit + shell + landing   [done]
- Changed: Added reusable UI primitives, responsive evidence-first landing page, authenticated brand workspace shell with URL query filters, responsive navigation, and placeholders for every workspace route.
- Verified: `npm run verify` passed (typecheck, lint, 5 tests, production build); build listed all 14 brand workspace destinations. Visible keyboard focus rings and reduced-motion handling are included.
- Decisions/deviations: Workspace pages remain honest placeholders pending their dependent data tasks; query filters update the URL only.
- Learnings: Next.js `usePathname` under Cache Components needs Suspense for unresolved dynamic brand routes.
- Next: T005
## 2026-10-14  T005  Brands & competitors   [done]
- Changed: Added ownership-checked brand/competitor APIs, brand dashboard and create form, editable Settings with aliases and competitor management, and transactional soft deletion. Added `brands.deleted_at` migration 001; tombstones retain historical records, including append-only chats.
- Verified: `npm run verify` passed (typecheck, lint, 8 tests, production build). Tests cover cross-user 404 read/delete, alias JSON storage, retained history, zero dangling brand references across all brand-scoped tables, and idempotent migration of a legacy database without `deleted_at`.
- Decisions/deviations: Applied the user's soft-delete decision to resolve the conflict with the append-only chat rule; the architecture and task verification now describe retained tombstones instead of hard cascades.
- Learnings: Keeping tombstone brand rows provides a stable target for historical foreign references even though the current schema does not declare foreign keys.
- Next: T006
## 2026-10-14  T006  Prompts, topics, suggestions   [done]
- Changed: Added brand-scoped prompt/topic APIs, access helpers and validation, intent/tier-based prompt suggestions, and the Active/Suggested/Inactive prompt manager with topic grouping, prompt editing/status changes, topic creation, and one-click suggestion adds. Prompt removal uses a `deleted_at` tombstone so append-only chats retain valid prompt references.
- Verified: `npm run verify` passed (typecheck, lint, 11 tests, production build). Tests confirm filled templates do not duplicate existing prompts, ownership/topic validation, topic uniqueness, status changes, soft-delete reference retention, and migration 002.
- Decisions/deviations: Prompt visibility, rank, and sentiment display “—” until tracking runs exist; no run metrics are invented. Extended migration 002 for `prompts.deleted_at`.
- Learnings: Keeping prompt tombstones alongside brand tombstones preserves the context needed to interpret historical chat rows.
- Next: T007
## 2026-10-14  T007  Mention detection   [done]
- Changed: Added `detectBrands` with escaped case-insensitive literal matching, Unicode-aware lookaround boundaries, aliases, earliest-match ordering, and one ranked hit per brand.
- Verified: `npm run verify` passed (typecheck, lint, 16 tests, production build). Detector tests cover required brand order, case-insensitive aliases, absent and embedded names, punctuation-adjacent matches, and C++ regex escaping.
- Decisions/deviations: none.
- Learnings: Ranking each brand by its earliest canonical or alias match avoids alias order changing reported position.
- Next: T008
## 2026-10-14  T008  Sentiment   [done]
- Changed: Added a bounded-window sentiment scorer with positive/negative lexicons, nearby negation flips, normalized scores from −1 to 1, ±0.15 labels, and null for absent/invalid mention positions.
- Verified: `npm run verify` passed (typecheck, lint, 21 tests, production build). Tests cover the requested negative/positive/neutral examples, missing mentions, and the ±160/+260 character window.
- Decisions/deviations: none; callers can persist the returned null when no mention was detected.
- Learnings: Short negation windows and clause breaks keep a nearby negator from flipping later contrast clauses.
- Next: T009
## 2026-10-14  T009  Citations   [done]
- Changed: Added citation extraction with URL/domain normalization and deduplication, domain classification, and transactional idempotent source/chat-source persistence.
- Verified: `npm run verify` passed (typecheck, lint, 24 tests, production build). Tests cover URL-plus-bare-domain dedupe, Reddit/forum and Stripe docs classification, own subdomains, and repeat persistence without duplicate rows.
- Decisions/deviations: `sources` stores normalized domains as its unique key; extracted URLs are retained in the in-memory citation result while the current schema stores only domain-level source rows.
- Learnings: Storing chat-source associations with a composite key makes reprocessing idempotent while keeping citation records linked by domain.
- Next: T010
## 2026-10-14  T010  Providers   [done]
- Changed: Added the stable provider interface, deterministic simulated platforms, optional Groq and Gemini REST adapters, environment-key registry, request throttling, sleep, and retry with exponential backoff for 429/503.
- Verified: `npm run verify` passed (typecheck, lint, 29 tests, production build). Offline tests cover no-key registry behavior, optional real-provider registration, deterministic and occasionally brand-omitting mocks, transient retry success, and non-retryable errors.
- Decisions/deviations: Provider model defaults are configurable through `GROQ_MODEL` and `GEMINI_MODEL`; defaults checked against current official model catalogs. Provider adapters return errors to the orchestration layer, which owns throttling and retry sequencing.
- Learnings: Per-provider throttling must serialize concurrent waiters to preserve the minimum interval between real calls.
- Next: T011
## 2026-10-14  T011  Tracking orchestrator + run UI   [done]
- Changed: Added authenticated tracking creation/status/history APIs, async prompt/provider orchestration with mention/sentiment/citation persistence and per-pair failure rows, plus Overview run controls with simulated status, progress bar, and signal animation. Mention detection now exposes the source index needed to score every hit.
- Verified: `npm run verify` passed (typecheck, lint, 32 tests, production build). Injected-provider tests confirm failures do not stop successful pairs, chat rows preserve locale and simulation flags, `brands_found` stores each brand's sentiment, citations persist, no-key mocks run, and `total_expected` is active prompts × providers.
- Decisions/deviations: Persisted provider failure details as a generic error to avoid leaking provider response bodies or credentials. Tracking responses and UI label simulated rows/runs explicitly.
- Learnings: A provider error row counts as a completed prompt/provider pair so run progress reaches its expected total even when a platform is unavailable.
- Next: T012
## 2026-10-14  T012  Seed/demo data   [done]
- Changed: Added an idempotent seed for the demo login, Acme Cloud, four competitors, three topics, ten prompts, six historical runs, and 180 simulated answers. `--reset` soft-deletes the active demo brand/prompts while preserving historical chats; answers use the production mention, sentiment, and citation functions.
- Verified: `npm run verify` passed (typecheck, lint, 34 tests, production build); ran `npm run seed` twice with the same 10 prompts, 6 runs, and 180 answers. Seed tests confirm six dated trend points with nondecreasing own-brand mentions, all rows simulated, rerun idempotence, and reset history retention.
- Decisions/deviations: The Overview API is scheduled for T015 and does not exist yet; the six-point trend acceptance was verified against seeded run/chat data directly, and the HTTP overview check can be made once that endpoint exists.
- Learnings: Soft-deleting seed entities supports a reset path without violating the append-only chat history rule.
- Next: T013
## 2026-10-14  T013  Smoke test script   [done]
- Changed: Added a self-starting HTTP smoke script using an isolated temporary SQLite database and blank provider keys; covers signup, brand creation, two competitors, three prompts, tracking, polling, and run history.
- Verified: `npm run smoke` passed with all nine expected prompt/mock-provider answers completed and simulated. `npm run verify` passed (typecheck, lint, 34 tests, production build). Persisted answer and simulated counts match run status and history.
- Decisions/deviations: The dedicated Overview API does not exist until T015, so the smoke script checks the current run overview totals against stored chats and run history; it does not create future endpoint scope. Next dev uses webpack in this script because the sandboxed Turbopack process panicked canonicalizing the Windows workspace; webpack passed once run with workspace filesystem access.
- Learnings: A clean, isolated DB and disabled provider keys make the end-to-end flow repeatable without disturbing developer data or calling external providers.
- Next: T014
## 2026-10-14  T014  Analytics service   [done]
- Changed: Added reusable `Scope`/`whereClause` with UTC inclusive date bounds, optional platform/prompt/tag/locale filters, and simulated exclusion by default. Added prepared-query analytics for per-run visibility, sentiment, platform visibility/rank, share of voice, and top cited sources.
- Verified: `npm run verify` passed (typecheck, lint, 37 tests, production build). New synthetic SQLite tests hand-check all five metrics, named filters, same-day boundaries, tag filtering, error-row exclusion, and simulated-data inclusion behavior.
- Decisions/deviations: Date-only `dateTo` includes that entire UTC date; timestamp `dateTo` is inclusive to the supplied second. Metrics use successful answers (`error IS NULL`) per PRD §7.
- Learnings: Keeping one scoped successful-answer query for the chat-based metrics makes denominator and filter behavior consistent across views.
- Next: T015
## 2026-10-14  T015  Overview   [done]
- Changed: Added authenticated `GET /api/brands/:id/overview`, server-rendered Overview page and responsive stat/chart/source/recent-chat sections. Connected shareable date, platform, locale, tag, and simulated filters to `Scope`; added custom UTC dates, per-brand visibility trend with 7-run average, sentiment donut, platform and share-of-voice bars, top sources, and filtered Chats links.
- Verified: `npm run verify` passed (typecheck, lint, 43 tests, production build). Synthetic hand-count assertions cover Overview KPIs and sources; route tests cover ownership 404 and query validation. Empty states distinguish no active prompts from no tracking data; simulated inclusion shows an honesty banner.
- Decisions/deviations: Filter selectors derive available platform/locale/tag values from the owned brand's existing rows; tag editing remains in T021. Moving-average toggle is local chart state, while analytic filters are URL-backed.
- Learnings: Keeping filter values in the URL lets the server page and API resolve the same date and sample scope and preserves filters when navigating to Chats.
- Next: T016
## 2026-10-14  T016  Chats log   [done]
- Changed: Added ownership-checked list/detail Chats APIs and a server-rendered Chats page with URL-backed filters, prompt search, 50-row pagination, topic-grouped prompt list, per-prompt run/platform timeline, answer highlights, citations, sentiment, and simulated badges. Raw answers render as React text; own-brand matches are amber and competitor matches muted.
- Verified: `npm run verify` passed (typecheck, lint, 47 tests, production build). New tests exercise prompt/date/platform/mention/sentiment filters, paging, details/citations, invalid custom ranges, boundary-aware brand matching, and preservation of HTML-looking answer text as literal segments.
- Decisions/deviations: The prompt timeline reflects the current 50-answer result page; filters and pagination are shareable URL parameters. Search matches prompt text and detail reads are constrained to the same owned-brand scope.
- Learnings: React text nodes preserve untrusted answer markup literally while allowing brand matches to be styled without HTML injection.
- Next: T017
## 2026-10-14  T017  Sources   [done]
- Changed: Added an ownership-checked sources API and scoped Sources page with domain type donut, citation total, Used % and average citations, cited-with brands, Domains/URLs tabs, and a gap-analysis toggle. Summary calculations use successful answers in the same date/platform/tag/locale/simulated scope as analytics; gap domains require competitor evidence and no own-brand evidence.
- Verified: `npm run verify` passed (typecheck, lint, 51 tests, production build). New synthetic SQLite checks hand-verify answer denominators, citation averages, type totals, simulated exclusion, and that the gap toggle returns only rival-cited domains never associated with the own brand. Route checks cover ownership 404 and invalid query 400.
- Decisions/deviations: Current schema stores normalized domains and domain-level citation counts, not original URL paths. The URLs tab states this limitation instead of deriving or presenting invented citation URLs.
- Learnings: Source usage percentages must divide distinct citing answers by all successful answers in the active scope; average citations use citations divided by distinct citing answers.
- Next: T018
## 2026-10-14  T018  Recommendation engine   [done]
- Changed: Added explainable R1–R7, R10, and R11 recommendation evaluation from successful real-data runs, evidence/basis persistence, open-item deduplication by rule and subject, run-completion generation, list/status APIs, and Off-page / On-page / Technical cards with evidence, rationale expanders, and To do/In progress/Done controls.
- Verified: `npm run verify` passed (typecheck, lint, 56 tests, production build). Synthetic SQLite fixtures trigger all implemented thresholds and R11, test R8/R9 remain dormant until crawl data exists, validate R7's two-run decline, and cover deduplication and done filtering; route tests cover ownership, query, and status validation.
- Decisions/deviations: R8 and R9 are no-ops until T023 adds crawl audit and structured-data evidence. Recommendations exclude simulated answers. Rationale text labels rules as heuristics and avoids unsupported causal or literature claims.
- Learnings: Evaluating each completed real run and persisting a rule/subject key makes repeated generation idempotent while retaining a visible status workflow.
- Next: T019
## 2026-10-14  T019  Gap opportunities   [done]
- Changed: Added shared-scope gap scoring API and page. Active prompts are ranked by `rivalRate × (1 − yourRate)`, strongest active competitor breaks ties, fully visible/no-rival prompts are omitted, and fewer-than-three samples are visibly greyed. Brief and Discovery actions are disabled until T025/T026.
- Verified: `npm run verify` passed (typecheck, lint, 60 tests, production build). Synthetic SQLite fixtures verify score math, dominant rival, descending score and answer-count tie ordering, 100%-visible exclusion, low-sample marking, shared filters, simulated inclusion, and ownership/query validation.
- Decisions/deviations: Gaps use only successful answers and active prompts/competitors. No search-volume weights are inferred; percentages show exact counts and sample size.
- Learnings: Deduplicating each competitor to one hit per answer keeps mention rates bounded by the prompt sample size.
- Next: T020
## 2026-10-14  T020  Ranking   [done]
- Changed: Added ranking metrics for active own/rival brands, an owner-checked API and scoped comparison page, equal-duration previous-window visibility deltas, per-brand sentiment and average rank, sample counts, and spreadsheet-safe CSV export.
- Verified: `npm run verify` passed (typecheck, lint, 63 tests, production build). Synthetic SQLite tests check the selected and immediately preceding equal windows, visibility deltas, per-brand sentiment/rank, missing history as n/a, and the You-first visibility ordering; CSV tests cover `=cmd`, `+`, `-`, `@`, separators, and line breaks.
- Decisions/deviations: Sentiment is displayed on a 0–100 scale from recorded numeric scores (mapped from -1..1), with sentiment labels as fallback. Optional radar chart omitted.
- Learnings: Period change is measured in percentage points, and is n/a only when the prior window contains no successful answers.
- Next: T021
## 2026-10-14  T021  Tags   [done]
- Changed: Added authenticated per-user tag list/create/delete APIs and prompt tag attach/detach routes, enforcing ownership on each brand-scoped request. Added case-insensitive duplicate reuse, prompt-row chips with tag autocomplete/create, account tag deletion, and retained the global URL-backed tag filter.
- Verified: `npm run verify` passed (typecheck, lint, 66 tests, production build). Tag tests prove case-insensitive uniqueness per user, ownership checks, and that the same tag scope filters Overview, Chats, Sources, and Gaps. Deleting a tag clears its associations while prompts and chat history remain.
- Decisions/deviations: Tags are managed per user and exposed through the authenticated brand workspace path so each endpoint can verify workspace ownership. A repeated case-insensitive create returns the existing tag.
- Learnings: Since all analytic views share `whereClause`, the existing `Scope.tagId` predicate propagates consistently without per-view filter logic.
- Next: T022
## 2026-10-14  T022  Content score   [done]
- Changed: Added deterministic content feature extraction and nine weighted checks, a brand-owned paste scoring API, saved score history with before/after point deltas, and a responsive scoring workspace listing passed checks and concrete fixes for every failed check.
- Verified: `npm run verify` passed (typecheck, lint, 71 tests, production build). A readable FAQ fixture scores above statistics-dense content; every failure includes a fix; SQLite tests verify rescoring history/delta; route tests verify ownership and reject URL mode.
- Decisions/deviations: T022 is paste-only until T023 provides the SSRF-safe fetcher; API rejects URL input rather than fetching unsafely. Scoring remains a transparent heuristic and does not claim to predict citations or rankings.
- Learnings: Persisting score attempts gives a direct before/after signal while preserving the underlying content and feature snapshot for future history views.
- Next: T023
## 2026-10-14  T023  Crawlability audit   [done]
- Changed: Added `safeFetch` with HTTP(S)/standard-port restrictions, DNS public-address checks, private-range and local-host blocking, redirect revalidation, GET-only requests, an 8-second timeout, and a 2 MB response cap. Added the ten-check crawl audit, robots rules parsing for seven AI crawlers, ownership-checked API, persisted score history/deltas, and responsive results page with fixes.
- Verified: `npm run verify` passed (typecheck, lint, 97 tests, production build). Offline tests cover localhost, loopback, link-local metadata, RFC1918/CGNAT/documentation/private IPv6, private DNS resolutions, redirect revalidation, size cap, method restriction, robots allow/disallow precedence, empty JS-shell HTML, failed-check fixes, route ownership, and saved audit history.
- Decisions/deviations: Robots HTTP 404 is treated as no published restrictions; an unavailable response other than 404 is reported as unknown/failed. The tool checks one page and same-origin robots/sitemap/llms endpoints only; it is explicitly described as a lightweight audit, not a full crawler.
- Learnings: Redirect targets need the same URL and DNS checks as the original request, and the initial HTML word count must exclude script/style contents.
- Next: T024
## 2026-10-14  T024  llms.txt / robots.txt generator   [done]
- Changed: Replaced the placeholder with a live generator for llms.txt and robots.txt. Site name/summary, editable key-page rows, optional about/contact URL, and per-agent allow/deny choices feed separate previews with Copy, Download, and a Crawl audit link. Robots output includes individual groups for seven audited agents plus Applebot-Extended and a wildcard allow group.
- Verified: `npm run verify` passed (typecheck, lint, 100 tests, production build). Builder tests verify sanitized single-line metadata, HTTP(S)-only links, sitemap URL construction, and that the generated robots file passes T023's parser with only the selected bot blocked.
- Decisions/deviations: The generator creates local drafts only; users review and upload them to their own site's root. The UI states that llms.txt is a proposed convention and does not guarantee citations or improved visibility.
- Learnings: Separate per-agent groups let an explicit deny override the wildcard allow without unintentionally changing other crawlers' access.
- Next: T025
## 2026-10-14  T025  Content brief generator   [done]
- Changed: Added a prompt-scoped evidence collector for tracked rival names/descriptions and cited domains, a deterministic [FILL IN]-safe brief skeleton, optional real-provider enrichment when Groq/Gemini keys exist, an authenticated owned-brand generation API with brief persistence, an escaped-text markdown workspace with copy/download and Content score link, and wired the Gaps action to the matching prompt.
- Verified: `npm run verify` passed (typecheck, lint, 102 tests, production build). Offline tests confirm deterministic briefs name the fixture rival and domain, retain rival snippet evidence, use [FILL IN] for unknown brand claims, scope data to the selected prompt, and return no context for an unrelated brand.
- Decisions/deviations: Provider enrichment falls back to the deterministic skeleton if a configured real provider fails. No provider is invoked or required by tests.
- Learnings: Stored brand IDs on mention records make it possible to select only active tracked competitors when deriving evidence sentences.
- Next: T026
## 2026-10-14  T026  Discovery feed   [done]
- Changed: Added Hacker News Algolia and Stack Exchange GET adapters plus optional Reddit OAuth/search, prompt keyword extraction, transparent log-normalized relevance and competitor boost, paced sequential refresh (maximum ten active prompts), saved/dismissed status, brand-owned APIs, and a feed UI with Open, Save, and Dismiss actions.
- Verified: `npm run verify` passed (typecheck, lint, 110 tests, production build). Mocked fetch tests prove the no-Reddit path works, only Reddit token exchange uses POST, source calls carry a descriptive User-Agent and are spaced by 1 second, scoring/competitor boost is deterministic, refresh twice upserts by brand+URL while preserving saved status, and each refresh searches at most ten prompts. Route tests cover ownership and status/filter validation.
- Decisions/deviations: Existing `discovery_items` schema already contains the required unique brand/URL key; its `subreddit` column stores each source's community label. Unavailable source calls are counted and refresh continues.
- Learnings: Sharing a paced fetch wrapper across adapters enforces the delay even between Reddit token exchange and its GET search while keeping tests fully offline.
- Next: T027
## 2026-10-14  T027  Reports & export   [done]
- Changed: Replaced the report placeholder with a print-styled light report covering dashboard KPIs, monthly trend, top prompt performance with prior-period change, competitor ranking, citations, top gaps, open recommendations, and real/simulated methodology. Added chats/ranking/sources CSV downloads, copyable public snapshot links with owner-scoped revocation, and read-only `/r/[token]` rendering.
- Verified: `npm run verify` passed (typecheck, lint, 116 tests, production build). Tests assert report KPIs equal `getOverview`, include per-range real/simulated counts and empty months, verify snapshot values stay frozen after new chats and revocation hides the snapshot, and check share/export route authorization and validation.
- Decisions/deviations: Report analytics are composed from the existing shared analytics, ranking, source, and gaps services. A small set of monthly and per-prompt rollups live in `analytics.ts` to keep metric logic centralized. Next.js 16.4 requires `instant = false` for the token route's request-time lookup.
- Learnings: Saving the fully rendered report data at link creation decouples public sharing from later tracking updates while retaining deletion-based revocation.
- Next: T028
## 2026-10-14  T028  Alerts & scheduler   [done]
- Changed: Added four configurable alert rules, real-answer minimum-sample checks, run-scoped duplicate protection, automatic alert evaluation after completed runs, owner-checked list/read/rule APIs, unread bell count, alerts page, daily scheduler, and a CRON_SECRET-protected tracking endpoint. Added migration 003 for alerts.source_run_id and its unique dedupe index.
- Verified: npm run verify passed (typecheck, lint, 120 tests, production build). Alert tests prove a 10-point drop creates exactly one alert, re-evaluation adds none, fewer than 10 answers creates none, scheduler starts once, and cron rejects missing secrets.
- Decisions/deviations: Alert analytics exclude simulated and failed answers; negative sentiment needs at least 10 analyzed brand mentions. Added node-cron (required by M22) with no other dependency changes. Node 24.20.0 remained in use after approval; existing better-sqlite3 and full verification passed.
- Learnings: Storing the source run on each alert allows database-level deduplication while preserving subsequent alerts from later runs.
- Next: T029
## 2026-10-14  T029  Locale tracking   [done]
- Changed: Added a per-prompt picker for Global and all 249 ISO-3166 alpha-2 countries, readable locale filter choices, and an explicit locale-hinted (approximate) label in the workspace and report. Groq/Gemini requests now receive a plain-language country nudge; chat rows continue to store the prompt locale as an immutable run-time snapshot.
- Verified: npm run verify passed (typecheck, lint, 125 tests, production build). New tests prove changing a prompt leaves chat history unchanged, locale scope consistently filters Overview trend/platform/sentiment/share/sources/recent answers, and country names appear in real-provider request payloads.
- Decisions/deviations: Existing prompt/chat locale columns, patch API, shared analytics Scope, and global filter already supported locale; no schema or dependency changes were needed. Legacy BCP-47 prompt values remain selectable and map to their country for provider hints.
- Learnings: Saving locale on each chat row is what lets a later prompt edit preserve the meaning of historical analytics.
- Next: T030
## 2026-10-14  T030  Public checker   [done]
- Changed: Added public `/check` and `POST /api/public/check` with brand/question validation, honeypot and minimum-render-time protection, per-IP hourly and global daily limits, hashed 24-hour result caching, and three sequential samples from one real provider or one simulated provider. Results include mention and position variability, sentiment with sample size, citations, other names, and expandable escaped answers; landing links now point to `/check`.
- Verified: `npm run verify` passed (typecheck, lint, 128 tests, production build). Offline tests prove the sixth hourly request is rejected, cached repeats make no additional provider calls, and the public API returns 429 at the limit.
- Decisions/deviations: Reused existing `public_check_cache` and `public_check_log` tables; no schema or dependency changes. Only hashed input is used for cache lookup; request logs retain IP and time for abuse limits.
- Learnings: The request timestamp is captured after client mount to meet Next.js 16 prerender restrictions while supporting the minimum-time check.
- Next: T031
## 2026-10-14  T031  API keys, REST v1, MCP   [done]
- Changed: Added one-time `er_` API keys stored as SHA-256 hashes, key list/revoke endpoints and a Developer page; bearer-or-session auth for REST v1 routes, five-run-per-key UTC daily accounting, ownership-checked MCP tools over Streamable HTTP, and `API.md` endpoint/client documentation.
- Verified: `npm run verify` passed (typecheck, lint, 132 tests, production build). Tests cover key hash-only persistence, revoked-key rejection, daily caps and reset, and ownership checks on every brand-scoped MCP tool.
- Decisions/deviations: Updated the task's legacy `@modelcontextprotocol/sdk` package reference to the current official `@modelcontextprotocol/server` v2.3.1 API after verifying current SDK and Claude Code/Cursor connection docs. Added schema migration 004 for daily API-key usage counts.
- Learnings: Building the MCP server per request lets its tool handlers close over only the authenticated user's ID and key ID.
- Next: T032
## 2026-10-14  T032  Experiment 1 tooling  [done]
- Changed: Added a preregistered five-topic synthetic-source design, provider-based version generator with feature manipulation checks, a human-reviewed-source gate, seeded resumable trials, and per-model Wilson intervals, chi-square analysis, and position-effect reporting. Added the sample CSV fixture and package scripts.
- Verified: `npm run verify` passed: typecheck, lint, 138 tests across 45 files, and production build. Tests hand-check fixture citation rates and chi-square output. No live provider calls were made.
- Decisions/deviations: Used the equivalent closed-form chi-square survival probability for df=2 instead of adding `jstat`; source drafts are marked unreviewed and must pass human review before any live trial.
- Learnings: Deriving each trial's shuffle from the preregistered seed and trial ID lets interrupted runs resume without changing earlier source positions.
- Next: T033
## 2026-10-14  T033  Research page  [done]
- Changed: Added `/research` to read and validate `research/results.json`, per-model Recharts citation bars with Wilson 95% error bars, rate/CI tables with denominators, the published comparison table, study limitations, and a missing/empty-results state.
- Verified: `npm run verify` passed with `VITEST_MAX_THREADS=1`: typecheck, lint, 140 tests across 46 files, and production build. Page tests render the sample fixture analysis and assert the missing-results empty state. Build completed without filesystem tracing warnings.
- Decisions/deviations: Published sample sizes are labeled as not stated in the project specification instead of being inferred. Invalid result JSON is handled like unavailable results.
- Learnings: Restricting the server-side results reader to a fixed project path keeps Next.js output tracing scoped.
- Next: T034
## 2026-10-14  T034  README & docs  [done]
- Changed: Replaced the stock Next.js README with a four-command clean-checkout quick start, Node/native SQLite guidance, scripts and environment tables, current architecture/API overview, operational and research limitations, accurate Codex use disclosure, and screenshots placeholder. Corrected `.env.example` to say outbound email is not implemented.
- Verified: `npm run verify` passed with `VITEST_MAX_THREADS=1`: typecheck, lint, 140 tests across 46 files, and production build. Cross-checked README scripts and settings against package.json, runtime env references, and implementation.
- Decisions/deviations: Recommended Node 22 LTS for clean setup while disclosing that the current project was verified on Node 24.20.0. Documented the seeded demo credential as public and local-only.
- Learnings: The environment template contained an unused Resend key; documentation now explicitly reflects the app's in-app-only alerts.
- Next: T035
## 2026-10-14  T035  Accessibility & responsive pass  [done]
- Changed: Audited shared shell and page components against DESIGN §7. Added scoped table headers, chart labels and keyboard-readable data links, form-error descriptions, and proper pressed-button semantics. The mobile navigation now traps focus, closes on Escape, and restores focus; mobile users retain all workspace filters. Replaced a decorative, nonfunctional user-menu button with a noninteractive marker.
- Contrast: Raised the muted text token and low-contrast navigation/sample caption colors; the primary muted token now measures 8.36:1 on panels and 9.06:1 on the page background. Visible focus styles and reduced-motion overrides were already in place and were retained.
- Verified: `npm run verify` passed: typecheck, lint, 140 tests across 46 files, and production build. `git diff --check` passed. Touched table headings now use explicit column and row scopes.
- Decisions/deviations: No dependencies or schema changes. Mobile filter controls reuse existing URL-backed filters.
- Learnings: Hiding shared filters at mobile breakpoints had removed access to filtering entirely; rendering the same controls in a compact mobile row preserves the existing URL behavior.
- Next: T036
