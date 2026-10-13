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
