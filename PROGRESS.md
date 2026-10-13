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