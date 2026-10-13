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
