# EchoRank

EchoRank is a local-first AI search visibility tracker. It records answers from configured AI providers, then helps inspect brand mentions, rankings, citations, source gaps, and recommendations. The built-in platform-labelled providers are **simulated**; they do not call ChatGPT, Perplexity, or Google AI. Real answer generation is available through optional Groq and Gemini API keys.

## Quick start

Use Node.js 22 LTS for a clean setup. `better-sqlite3` is a native module; the project has also been verified in its current development environment on Node 24.20.0.

From an existing clean checkout, setup takes four PowerShell commands (the editor step is for setting the secret):

```powershell
Copy-Item .env.example .env
notepad .env
npm ci
npm run dev
```

Set `AUTH_SECRET` in `.env` to a random value of at least 32 bytes before using sign-up or login. For example, generate one in PowerShell with:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Paste the generated value into `.env`; keep `.env` private. `npm run dev` runs the database migration automatically. Open [http://localhost:3000](http://localhost:3000), create an account, and add a brand and prompts. Without provider keys, tracking uses simulated data, which is labeled in the UI and excluded from headline metrics by default.

The same four-step setup in a POSIX shell is `cp .env.example .env`, edit `.env` to set `AUTH_SECRET`, `npm ci`, and `npm run dev`.

### Optional demo account

Run `npm run seed` to add repeatable simulated demo history. The command prints the demo login (`demo@echorank.local` / `demo1234`). This fixed local-only credential is public in the source: do not expose a seeded instance to the internet. `npm run seed -- --reset` soft-deletes the prior demo brand and recreates the sample.

## Environment variables

Copy `.env.example` to `.env`. Only `AUTH_SECRET` is required for account authentication. API keys are optional; leave them empty to use simulated tracking.

| Variable | Required | Purpose |
|---|---:|---|
| `AUTH_SECRET` | Yes for authentication | Signing secret; configure at least 32 bytes. |
| `DATABASE_PATH` | No | SQLite file path; defaults to `./echorank.db`. Keep database files private and backed up. |
| `GROQ_API_KEY` | No | Enables real answer generation through Groq. |
| `GROQ_MODEL` | No | Overrides the Groq model; default is `llama-3.3-70b-versatile`. |
| `GEMINI_API_KEY` | No | Enables real answer generation through Gemini. |
| `GEMINI_MODEL` | No | Overrides the Gemini model; default is `gemini-2.5-flash`. |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | No | Optional Reddit search for Discovery; configure both. Hacker News and Stack Exchange adapters do not need credentials. |
| `CRON_SECRET` | No | Protects `POST /api/cron/track`; configure it before exposing that endpoint. |

Email delivery is not implemented in the current app. A `RESEND_API_KEY` entry that appeared in an earlier environment template is intentionally not listed as an active setting.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js development server; migrates the database first. |
| `npm run build` | Migrate and build the production app. |
| `npm run start` | Serve a production build. |
| `npm run verify` | Run TypeScript typecheck, ESLint, Vitest, and production build. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run lint` | Run ESLint. |
| `npm run test` | Run the offline Vitest suite. |
| `npm run db:migrate` | Apply the idempotent SQLite schema/migrations. |
| `npm run seed` | Create simulated demo data; accepts `-- --reset`. |
| `npm run smoke` | Run a local end-to-end smoke check using temporary data and simulated providers. |
| `npm run experiment1:versions -- --provider=groq` | Generate pilot source drafts with a real configured provider; review them before use. |
| `npm run experiment1:run -- --provider=groq` | Collect/resume real provider trials after manually marking reviewed sources. This makes live API calls. |
| `npm run experiment1:analyze` | Analyze the saved trial CSV offline and write research results/report files. |

The experiment commands and their human review gate are described in [`research/experiment1/preregistration.md`](research/experiment1/preregistration.md). Tests do not call live providers.

## Architecture

- **Web app:** Next.js App Router pages and route handlers in `src/app/`; React and TypeScript, with Tailwind CSS and Recharts for data views.
- **Application logic:** focused modules under `src/lib/` for authentication, provider orchestration, analysis, tracking, and analytics. Zod validates request data.
- **Storage:** SQLite through `better-sqlite3` and Drizzle. The source schema is [`docs/schema.sql`](docs/schema.sql); `npm run db:migrate` applies it and compatible migrations. Chat answer history is append-only; removals of brands/prompts use soft-delete timestamps.
- **Answer providers:** three built-in simulated providers are always available. Groq and Gemini adapters are added only when their keys are configured. Real calls are throttled and failures are retained/handled by tracking.
- **Discovery:** read-only Hacker News, Stack Exchange, and optional Reddit search. EchoRank does not post, reply, vote, or message on those services.
- **Public/developer surfaces:** `/check` is a rate-limited public sample checker; `/api/v1/*` exposes the REST API and `/api/mcp` exposes authenticated MCP tools. See [`API.md`](API.md) for routes and connection examples.
- **Research:** the public `/research` page reads the generated `research/results.json`; the small in-context pilot uses synthetic source text and is separate from live retrieval tracking.

## Limitations

- Simulated answers are illustrative fixtures, not observations from the named AI platforms. A Groq or Gemini response is also not a direct measurement of what ChatGPT, Perplexity, or Google AI would return.
- Provider answers and web discovery can vary, fail, or be unavailable. Results depend on the selected provider/model, prompt, time, and configured sources; locale hints are approximate, not verified geographic targeting.
- Citation and visibility metrics describe collected samples, not population-wide rankings. The research pilot is small, synthetic, and in-context; its intervals and tests are exploratory and do not establish causation or real-world retrieval effects.
- SQLite is intended for local/small-scale use here. Production hosting, multi-instance coordination, database operations, provider-key management, and independent security review need deployment-specific work.
- In-app alerts work, but outbound email delivery is not implemented. No external usability-study feedback is included with this repository.

## AI-assistant use disclosure

Codex, an AI coding assistant, was used during this project to scaffold and implement application features, tests, and project documentation. The repository's verification suite is run as changes are completed, but passing automated checks is not an independent security audit or a guarantee that generated code is error-free. Simulated data and the synthetic research pilot are identified as such; no user-study results or external feedback are claimed here.

## Screenshots

Add genuine screenshots of the running application to [`screenshots/`](screenshots/). The folder currently contains only a placeholder; no screenshots are included or implied.
