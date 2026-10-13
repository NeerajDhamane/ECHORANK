# EchoRank — Master Build Plan (End-to-End, Zero-Context Ready)

> **How to use this document:** This is a complete, self-contained implementation plan for building EchoRank — an AI Search Visibility & Optimization platform — from an empty folder to a fully working product. It assumes **no prior code exists**. Every module below can be built and tested on its own, and they are ordered so each module only depends on modules that come before it. If you are picking this up in a brand-new chat with zero context: read this whole document once, then work top to bottom, one module at a time, and tick the acceptance criteria at the end of each module before moving on.

---

## Table of Contents (module → section)

| Module | Feature | Section |
|---|---|---|
| 0 | Project setup | 3 |
| – | Database schema | 4 |
| 1 | Authentication | 5 |
| 2 | Brand & competitor management | 6 |
| 3 | Prompts + suggestions | 7 |
| 4 | Multi-platform AI querying engine | 8 |
| 5 | Mention detection, ranking, orchestrator | 9 |
| 6 | Sentiment analysis | 10 |
| 7 | Citation / source extraction | 11 |
| 8 | Content compatibility score | 12 |
| 9–13 | Visibility trend, sentiment chart, share of voice, chats log, sources view | 13 |
| 14 | Recommendation engine | 14 |
| 15 | Gap opportunities | 15 |
| 16 | Discovery feed | 16 |
| 17 | Crawlability checker | 17 |
| 18 | Content brief generator | 18 |
| 19 | Ranking comparison | 19 |
| 20 | Tags | 20 |
| 21 | Report export | 21 |
| 22 | Alerts + scheduler | 22 |
| 23 | llms.txt / robots.txt generator | 23 |
| 24 | Public visibility checker | 24 |
| 25 | Locale tracking | 25 |
| 26 | MCP server & API | 26 |
| – | Experiments (replication, case study) | 27–28 |
| – | Build order, scope, testing, deployment, risks | 29–33 |
| – | Appendices (new-chat prompt, links, glossary, checklist) | A–D |

---

## 0. Project Overview

**What we're building:** A platform that tracks whether AI assistants (via free-tier APIs) mention a brand when answering buyer-intent questions, benchmarks that brand against competitors, and turns the tracked data into concrete, evidence-backed recommendations.

**Why this is a real problem (keep this framing for any report or panel):**
- Traditional SEO optimizes for a ranking algorithm. AI assistants use retrieval + generation instead — rank barely matters, retrievability and clarity do.
- There is no equivalent of Google Search Console for AI-generated answers. Businesses cannot see whether they are mentioned, misrepresented, or absent.
- A single chat response is a noisy, non-deterministic sample — not a measurement. You need repeated, logged tracking over time to get an actual visibility percentage. This is the entire technical justification for building this as a system instead of "just asking ChatGPT."

**Product category:** Generative Engine Optimization (GEO) / Answer Engine Optimization (AEO). Comparable commercial products: ZeroRank, Otterly.ai, Peec AI, AthenaHQ, CrowdReply.

**How tracking actually works (the one mechanism everything rests on):** there is no secret analytics API. A tool like this literally (1) takes a prompt, (2) sends it to an AI platform's API, (3) parses the raw text answer for brand names, (4) repeats on a schedule and stores every result. Visibility % is just `answers mentioning you ÷ total answers` over time.

**What "influencing" AI answers really means (be honest in any presentation):** no dashboard directly controls ChatGPT. The causal chain is: *the tool shows you a gap → you change real-world content (FAQ page, schema, third-party listings) → AI retrieval later picks it up → the tool re-measures and shows whether the number moved.* The product delivers **detection + a feedback loop**, not control.

---

## 1. Non-Negotiable Constraints

1. **Everything must be free.** No paid APIs, no paid infrastructure anywhere in the core build.
2. **No time constraint** — depth and correctness matter more than speed.
3. **No PC spec constraint** — this is a standard web app, not ML training.
4. **No ToS-violating or ethically indefensible features** — no automated posting on Reddit/Quora, no paid backlink schemes.
5. **Every recommendation must be explainable** and traceable to the user's own tracked numbers — never a black-box LLM opinion presented as fact.

---

## 2. Full Tech Stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router, TypeScript)** | One framework for UI + API routes; free to deploy on Vercel's free tier |
| Database | **SQLite via `better-sqlite3` + Drizzle ORM** | Zero external service, zero cost, file-based. Avoids Prisma's engine-binary downloads, which fail on restricted networks |
| Auth | **Custom JWT in httpOnly cookie (`jose` + `bcryptjs`)** | No third-party auth service, full control |
| Styling | **Tailwind CSS** | Fast, free |
| Charts | **Recharts** | Free, React-native |
| AI providers | **Groq (free tier, Llama models) + Google Gemini (free tier)** | Genuinely free, no credit card. A **Mock provider** fills any platform without a key so the product always works end to end |
| Discovery | **Reddit public API (free developer app)** | Only free source of "where is this topic being discussed" |
| PDF export | **Browser print-to-PDF of a print-styled page** (zero dependency) or `@react-pdf/renderer` | No paid PDF service |
| Alerts | **In-app notifications by default; optional Resend free tier (3,000 emails/mo)** | Keeps the default build free of external signups |
| MCP server | **`@modelcontextprotocol/sdk`** | Official, free, open source |

---

## 3. Project Setup (Module 0)

### 3.1 Scaffold

```bash
npx create-next-app@latest echorank --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd echorank
npm install better-sqlite3 drizzle-orm jose bcryptjs zod recharts date-fns lucide-react clsx
npm install -D drizzle-kit @types/better-sqlite3 @types/bcryptjs tsx
```

> **Known pitfall:** Prisma's CLI downloads engine binaries from `binaries.prisma.sh`, which is blocked on many sandboxed/corporate networks. `better-sqlite3` + Drizzle gets everything from npm only. Use it.

> **Known pitfall 2:** `next/font/google` fetches fonts at build time and fails offline. Use `@fontsource/*` npm packages instead (`npm i @fontsource/inter @fontsource/space-grotesk @fontsource/jetbrains-mono`) and import their CSS in `layout.tsx`.

### 3.2 Folder structure

```
src/
  app/
    page.tsx                     landing page
    login/  signup/              auth pages
    dashboard/                   brand list + create
    dashboard/[brandId]/         workspace (tabs for every feature)
    api/                         REST routes, one folder per resource
  components/                    shared UI
  lib/
    auth.ts  require-auth.ts  brand-access.ts
    providers/                   AI provider layer (Module 4)
    analysis/                    mention / sentiment / citation (Modules 5-7)
    tracking.ts                  orchestrates a run
    recommendations.ts           rule engine (Module 14)
    ...one file per module
  db/
    schema.ts  index.ts  migrate.ts
```

### 3.3 Environment variables (`.env`)

```bash
AUTH_SECRET=replace-with-a-long-random-string
GROQ_API_KEY=             # optional, free: https://console.groq.com/keys
GEMINI_API_KEY=           # optional, free: https://aistudio.google.com/apikey
REDDIT_CLIENT_ID=         # optional, free: https://www.reddit.com/prefs/apps
REDDIT_CLIENT_SECRET=     # optional
DATABASE_PATH=./echorank.db
```

### 3.4 Migrations without network calls

Hand-write the schema as raw SQL executed at startup (full SQL in Section 4). Wire it so it always runs:

```json
"scripts": {
  "db:migrate": "tsx src/db/migrate.ts",
  "predev": "npm run db:migrate",
  "prebuild": "npm run db:migrate",
  "dev": "next dev",
  "build": "next build",
  "start": "next start"
}
```

---

## 4. Complete Database Schema (all 26 modules)

Design rules for every table:
- Primary keys are text UUIDs (`crypto.randomUUID()`), never auto-increment ints.
- **Competitors are rows in `brands`**, not a separate table. A tracked brand has `owner_brand_id = NULL`; a competitor has `owner_brand_id = <tracked brand id>`. This lets Ranking, Sources and Sentiment treat your brand and competitors uniformly.
- `chats` is the atomic fact table and is **append-only**. Never edit a historical row; re-run tracking instead so trend charts stay honest.
- Every query must be scoped by `user_id` via brand ownership. Never trust a `brandId` from a URL without checking ownership (`getOwnedBrand`, Module 2).

### 4.1 Full SQL migration (`src/db/migrate.ts`)

```typescript
import { sqlite } from "./index";

sqlite.exec(`
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
`);
console.log("Migration complete.");
```

### 4.2 Drizzle definitions (`src/db/schema.ts`)

Mirror every table above. Pattern (repeat for each table):

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  ownerBrandId: text("owner_brand_id"),
  name: text("name").notNull(),
  aliases: text("aliases").default("[]"),
  website: text("website"),
  industry: text("industry"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  promptId: text("prompt_id").notNull(),
  brandId: text("brand_id").notNull(),
  platform: text("platform").notNull(),
  isSimulated: integer("is_simulated", { mode: "boolean" }).notNull().default(false),
  rawResponse: text("raw_response"),
  mentioned: integer("mentioned", { mode: "boolean" }).notNull().default(false),
  position: integer("position"),
  sentiment: text("sentiment"),
  sentimentScore: real("sentiment_score"),
  brandsFound: text("brands_found").default("[]"),
  citedSources: text("cited_sources").default("[]"),
  error: text("error"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
// users, topics, prompts, tags, promptTags, trackingRuns, sources, chatSources,
// recommendations, discoveryItems, crawlAudits, contentScores, contentBriefs,
// alertRules, alerts, publicCheckLog, apiKeys: define the same way.
```

### 4.3 DB client singleton (`src/db/index.ts`)

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "echorank.db");
const globalForDb = globalThis as unknown as { sqlite?: Database.Database };

const sqlite = globalForDb.sqlite ?? new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
if (process.env.NODE_ENV !== "production") globalForDb.sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { sqlite };
```

> **Why the `globalThis` trick:** Next.js dev hot-reload re-evaluates modules constantly. Without caching the connection on `globalThis`, you leak a new SQLite handle on every reload.

---

## 5. MODULE 1 — Authentication & Session

**Purpose:** sign up, log in, log out; protect every dashboard page and API route.
**Depends on:** Module 0. **Source of idea:** universal SaaS baseline (ZeroRank, Otterly, Peec).

### 5.1 Session helper (`src/lib/auth.ts`)

```typescript
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
const COOKIE = "echorank_session";

export interface SessionPayload { userId: string; email: string; name: string }

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch { return null; }
}

export async function destroySession() { (await cookies()).delete(COOKIE); }
```

### 5.2 API guard (`src/lib/require-auth.ts`)

```typescript
import { NextResponse } from "next/server";
import { getSession } from "./auth";

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    return { session: null, res: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { session, res: null };
}
```

Use at the top of every protected route:
```typescript
const { session, res } = await requireSession();
if (!session) return res;
```

### 5.3 Routes

| Route | Method | Behavior |
|---|---|---|
| `/api/auth/signup` | POST | zod-validate (`name`, `email`, `password >= 6`), 409 on duplicate email, hash, insert, create session |
| `/api/auth/login` | POST | look up by email, `verifyPassword`; return the **same** 401 message for unknown email and wrong password |
| `/api/auth/logout` | POST | `destroySession()` |

```typescript
// src/app/api/auth/signup/route.ts
const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const { name, email, password } = parsed.data;

  if (db.select().from(users).where(eq(users.email, email)).get())
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const id = randomUUID();
  db.insert(users).values({ id, name, email, passwordHash: await hashPassword(password) }).run();
  await createSession({ userId: id, email, name });
  return NextResponse.json({ ok: true });
}
```

### 5.4 Page guard

`src/app/dashboard/layout.tsx` is a **server component**: call `getSession()`, `redirect("/login")` if null. Because it wraps every dashboard page, no page needs its own check.

### 5.5 Acceptance criteria
- [ ] Signup creates a user, sets the cookie, lands on `/dashboard`
- [ ] Duplicate email returns 409
- [ ] Wrong password and unknown email return identical 401 messages
- [ ] Visiting `/dashboard` logged-out redirects to `/login`
- [ ] Cookie is `httpOnly` (JS in devtools cannot read it)

---

## 6. MODULE 2 — Brand & Competitor Management

**Purpose:** create tracked brands and attach competitors, all stored in the one `brands` table.
**Depends on:** Modules 0, 1. **Source:** ZeroRank "Brands", Peec AI, CrowdReply (universal baseline).

### 6.1 Ownership helper (`src/lib/brand-access.ts`) — security-critical

```typescript
import { db } from "@/db";
import { brands } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/** Returns the tracked brand only if it belongs to this user. Use in EVERY brand-scoped route. */
export function getOwnedBrand(brandId: string, userId: string) {
  return db.select().from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.userId, userId), isNull(brands.ownerBrandId)))
    .get();
}

export function getCompetitors(brandId: string) {
  return db.select().from(brands).where(eq(brands.ownerBrandId, brandId)).all();
}
```

> **Why this matters:** without it, any logged-in user could read another user's data by changing the id in a URL. This one function is the multi-tenancy boundary of the whole app.

### 6.2 Routes

| Route | Method | Behavior |
|---|---|---|
| `/api/brands` | GET | list the user's tracked brands (`owner_brand_id IS NULL`) |
| `/api/brands` | POST | create brand `{name, website?, industry?, aliases?[]}` |
| `/api/brands/[id]` | GET | brand + competitors + prompts |
| `/api/brands/[id]` | DELETE | delete brand and cascade (competitors, prompts, chats...) |
| `/api/brands/[id]/competitors` | POST | add competitor `{name, website?, aliases?[]}` |
| `/api/brands/[id]/competitors` | DELETE | remove competitor `{competitorId}` |

Create-brand route:

```typescript
const schema = z.object({
  name: z.string().min(1).max(100),
  website: z.string().max(200).optional(),
  industry: z.string().max(100).optional(),
  aliases: z.array(z.string().max(100)).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const { session, res } = await requireSession();
  if (!session) return res;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const id = randomUUID();
  db.insert(brands).values({
    id, userId: session.userId,
    name: parsed.data.name,
    website: parsed.data.website,
    industry: parsed.data.industry,
    aliases: JSON.stringify(parsed.data.aliases ?? []),
  }).run();
  return NextResponse.json({ id });
}
```

Cascade delete (SQLite does not cascade without FKs declared, so do it explicitly in a transaction):

```typescript
sqlite.transaction(() => {
  const compIds = db.select({ id: brands.id }).from(brands).where(eq(brands.ownerBrandId, id)).all().map(r => r.id);
  for (const t of ["chats", "prompts", "tracking_runs", "recommendations", "discovery_items",
                   "crawl_audits", "content_scores", "content_briefs", "alert_rules", "alerts", "topics"]) {
    sqlite.prepare(`DELETE FROM ${t} WHERE brand_id = ?`).run(id);
  }
  for (const cid of compIds) sqlite.prepare("DELETE FROM brands WHERE id = ?").run(cid);
  sqlite.prepare("DELETE FROM brands WHERE id = ?").run(id);
})();
```

### 6.3 UI
- `/dashboard` — grid of brand cards + "Add brand" form (name, website, industry).
- Inside the workspace, a **Competitors** tab: input + list with remove buttons.
- Tip: when a brand is created, offer "Add 3 competitors now" inline — the product is useless without competitors, so don't hide it.

### 6.4 Acceptance criteria
- [ ] User A cannot fetch User B's brand (returns 404, not 403 — don't reveal existence)
- [ ] Competitors appear only under their owner brand
- [ ] Deleting a brand leaves no orphan rows (check with `SELECT COUNT(*)` on each table)
- [ ] Aliases are stored as a JSON array and returned parsed

---

## 7. MODULE 3 — Prompt Management + AI-Suggested Prompts

**Purpose:** manage the buyer-intent questions being tracked, grouped into Topics, with auto-suggestions.
**Depends on:** Module 2. **Source:** ZeroRank "Prompts" tab (topic groups, Active/Suggested/Inactive), Otterly prompt research.

> A prompt is the **unit of measurement**. No prompts → no data → nothing else in the product has anything to show.

### 7.1 Data behavior
- `status`: `active` (tracked each run), `suggested` (candidate, not tracked), `inactive` (paused).
- `topic_id` groups prompts (e.g. "Frontend Deployment", "Pricing & Plans"). Topic rows are collapsible in the UI and show aggregate visibility.
- `locale` is stored now so Module 25 needs no migration.

### 7.2 Template-based suggestion generator (free, no LLM call) — `src/lib/prompt-suggestions.ts`

```typescript
const INTENTS: Array<{ topic: string; templates: string[] }> = [
  { topic: "Best-of / Recommendations", templates: [
    "What is the best {industry} tool in {year}?",
    "What are the top {industry} platforms for small businesses?",
    "Which {industry} platform offers the best value for money?",
  ]},
  { topic: "Comparisons", templates: [
    "Compare the leading {industry} solutions available today.",
    "{brand} vs {competitor}: which is better for {industry}?",
  ]},
  { topic: "Alternatives", templates: [
    "What are good alternatives to {competitor}?",
    "Best alternatives to popular {industry} tools",
  ]},
  { topic: "Buying Guidance", templates: [
    "What should I look for when choosing a {industry} tool?",
    "Is {brand} worth it for a startup?",
  ]},
  { topic: "Problem / Use-case", templates: [
    "How do I solve {problem} with {industry} software?",
    "What {industry} software do most agencies use?",
  ]},
];

export function suggestPrompts(ctx: {
  industry: string; brand: string; competitors: string[];
}): Array<{ topic: string; text: string }> {
  const year = new Date().getFullYear();
  const comp = ctx.competitors[0] ?? "the market leader";
  const out: Array<{ topic: string; text: string }> = [];
  for (const group of INTENTS) {
    for (const t of group.templates) {
      out.push({
        topic: group.topic,
        text: t.replaceAll("{industry}", ctx.industry || "software")
               .replaceAll("{year}", String(year))
               .replaceAll("{brand}", ctx.brand)
               .replaceAll("{competitor}", comp)
               .replaceAll("{problem}", "your main pain point"),
      });
    }
  }
  return out;
}
```

### 7.3 Optional LLM-assisted tier
When a Groq/Gemini key exists, add a "Generate with AI" button that sends:

```
You are helping a marketer. Brand: {brand}. Industry: {industry}. Site: {website}.
List 15 distinct questions a real buyer would type into an AI assistant when researching
this category. One per line, no numbering, no commentary.
```
Split on newlines, dedupe against existing prompts (case-insensitive), insert as `status='suggested'`.

### 7.4 Routes

| Route | Method | Behavior |
|---|---|---|
| `/api/brands/[id]/prompts` | GET | list (filter `?status=`), `?suggest=1` returns generated suggestions |
| `/api/brands/[id]/prompts` | POST | create `{text, topicId?, status?, locale?}` |
| `/api/brands/[id]/prompts/[pid]` | PATCH | update text / status / topic / locale |
| `/api/brands/[id]/prompts/[pid]` | DELETE | remove prompt |
| `/api/brands/[id]/topics` | POST | create topic `{name}` |

### 7.5 Acceptance criteria
- [ ] Suggestions never duplicate an existing prompt
- [ ] Clicking a suggestion moves it to `active` without a page reload
- [ ] A prompt with zero runs shows "—", **not** "0%" (those mean different things)
- [ ] Deleting a topic reassigns its prompts to "Ungrouped"

---

## 8. MODULE 4 — Multi-Platform AI Querying Engine

**Purpose:** send each prompt to AI platforms and return raw text. This is the real data-collection mechanism of the entire product.
**Depends on:** Module 3. **Source:** ZeroRank (17 platforms), Otterly (4–6), Peec (4) — all do exactly this.

### 8.1 The provider interface (everything else depends on this staying stable)

```typescript
// src/lib/providers/types.ts
export interface AIProvider {
  id: string;           // "groq-llama-3.1-8b"
  label: string;        // shown in UI: "Groq (Llama 3.1 8B)"
  isMock: boolean;
  run(prompt: string, opts?: { locale?: string }): Promise<string>;
}
```

Adding ChatGPT/Claude/Perplexity later = one new file implementing this interface. Nothing else changes. That is the entire point of this layer.

### 8.2 Groq provider (free tier) — `src/lib/providers/groq.ts`

```typescript
import type { AIProvider } from "./types";

export function createGroqProvider(model = "llama-3.1-8b-instant"): AIProvider {
  return {
    id: `groq-${model}`,
    label: `Groq (${model})`,
    isMock: false,
    async run(prompt) {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error("GROQ_API_KEY not set");
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,   // keep >0: we WANT natural variation, we measure it across runs
          max_tokens: 700,
        }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}
```

> **Model names change.** If you get a 404/"model not found", open https://console.groq.com/docs/models and swap the string. Treat model names as config, not constants.

### 8.3 Gemini provider (free tier) — `src/lib/providers/gemini.ts`

```typescript
export function createGeminiProvider(model = "gemini-1.5-flash"): AIProvider {
  return {
    id: `gemini-${model}`,
    label: `Gemini (${model})`,
    isMock: false,
    async run(prompt) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY not set");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    },
  };
}
```

### 8.4 Mock provider (so the product always works with zero keys) — `src/lib/providers/mock.ts`

```typescript
function seeded(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
}

const TEMPLATES = [
  (b: string, c: string) => `Most people recommend ${c} for its mature ecosystem, though ${b} is gaining attention for ease of use and fair pricing. Both are trusted choices.`,
  (b: string, c: string) => `Common picks are ${c}, ${b}, and a few niche tools. ${b} stands out for its innovative approach (see g2.com and capterra.com).`,
  (_b: string, c: string) => `The leading choice is ${c}, praised for reliability. I don't have enough information to recommend an alternative confidently.`,
  (b: string, c: string) => `${b} is often highlighted as a top pick for growing teams, while ${c} is a solid, established option for enterprises (sources: trustpilot.com, reddit.com).`,
];

export function createMockProvider(name: string, brand: string, competitors: string[]): AIProvider {
  return {
    id: `mock-${name.toLowerCase().replace(/\s+/g, "-")}`,
    label: `${name} (simulated)`,
    isMock: true,
    async run(prompt) {
      const r = seeded(prompt + name + new Date().toISOString().slice(0, 10));
      const comp = competitors[Math.floor(r() * Math.max(1, competitors.length))] ?? "a market leader";
      const text = TEMPLATES[Math.floor(r() * TEMPLATES.length)](brand, comp);
      return r() > 0.3 ? text : text.replaceAll(brand, "").replace(/\s{2,}/g, " "); // sometimes absent
    },
  };
}
```

**Always label simulated rows** (`is_simulated = 1`) and show a visible "simulated" badge in the UI. Never let simulated data be mistaken for real measurement — this matters for honesty in your report.

### 8.5 Registry — picks real providers when keys exist (`src/lib/providers/registry.ts`)

```typescript
export function getProviders(brand: string, competitors: string[]): AIProvider[] {
  const list: AIProvider[] = [];
  if (process.env.GROQ_API_KEY) list.push(createGroqProvider());
  if (process.env.GEMINI_API_KEY) list.push(createGeminiProvider());
  // fill remaining "platform slots" with clearly-labelled simulations
  for (const n of ["ChatGPT", "Perplexity", "Claude", "Copilot"]) {
    list.push(createMockProvider(n, brand, competitors));
  }
  return list;
}
```

### 8.6 Rate limiting & retries (free tiers WILL throttle you)

```typescript
// src/lib/providers/throttle.ts
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let delay = 1500;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e: any) {
      const retryable = /429|503|rate|quota/i.test(String(e?.message));
      if (!retryable || i === tries - 1) throw e;
      await sleep(delay); delay *= 2;      // exponential backoff
    }
  }
  throw new Error("unreachable");
}
```
Add `await sleep(2200)` between **real** provider calls (≈27 req/min, safely under typical free-tier caps). Skip the delay for mock providers.

### 8.7 Locale hint (Module 25 hook)
If `locale !== "global"`, prefix the prompt: `"Answer as if the user is located in ${country}. ${prompt}"`. **Be honest in the report:** this is a prompt-level nudge, not true geo-differentiated retrieval like Google AI Overviews has.

### 8.8 Acceptance criteria
- [ ] With **no** keys set, a run still completes using only simulated providers
- [ ] With a Groq key set, at least one row has `is_simulated = 0` and real text
- [ ] A 429 triggers backoff and retry instead of failing the whole run
- [ ] One provider throwing does not stop the other providers (see Module 5's orchestrator, Section 9)

---

## 9. MODULE 5 — Mention Detection, Ranking & the Tracking Orchestrator

**Purpose:** read each raw AI answer and determine (a) is the brand mentioned, (b) in what order relative to competitors; then wire every module so one click produces stored results.
**Depends on:** Modules 2–4. **Source:** ZeroRank "Ranking", Peec share-of-voice, Otterly ranking.

### 9.1 Core algorithm

For each tracked brand and each competitor (names + aliases):
1. Build a case-insensitive, word-boundary regex.
2. Find the character index of the **first** match in the response.
3. Sort all found brands by that index ascending → the order **is** the position (1 = mentioned first).
4. Not found → `mentioned = false`, `position = null`.

```typescript
// src/lib/analysis/mentions.ts
export interface BrandRef { id: string; name: string; aliases: string[]; isOwn: boolean }
export interface BrandHit { brandId: string; name: string; position: number; index: number }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function detectBrands(text: string, brands: BrandRef[]): BrandHit[] {
  const found: Omit<BrandHit, "position">[] = [];
  for (const b of brands) {
    let best = Infinity;
    for (const n of [b.name, ...b.aliases].filter(Boolean)) {
      // \b fails next to non-word chars like "." in "Monday.com"; use lookarounds instead
      const re = new RegExp(`(?<![\\w])${esc(n.trim())}(?![\\w])`, "i");
      const m = re.exec(text);
      if (m && m.index < best) best = m.index;
    }
    if (best !== Infinity) found.push({ brandId: b.id, name: b.name, index: best });
  }
  return found.sort((a, b) => a.index - b.index).map((f, i) => ({ ...f, position: i + 1 }));
}
```

> **Pitfall solved:** `\b` word boundaries break on names like `Monday.com` or `C++`. The negative lookaround version works for any name.
> **Pitfall to document:** short/common-word brand names ("Notion", "Linear", "Stripe") cause false positives. Add an optional **context check** — require a nearby capitalised form or the domain — as a configurable per-brand flag.

### 9.2 Orchestrator (`src/lib/tracking.ts`)

```typescript
export async function runTracking(brandId: string, trigger: "manual" | "scheduled" = "manual") {
  const brand = db.select().from(brands).where(eq(brands.id, brandId)).get();
  if (!brand) throw new Error("Brand not found");
  const comps = getCompetitors(brandId);

  const refs: BrandRef[] = [
    { id: brand.id, name: brand.name, aliases: JSON.parse(brand.aliases ?? "[]"), isOwn: true },
    ...comps.map(c => ({ id: c.id, name: c.name, aliases: JSON.parse(c.aliases ?? "[]"), isOwn: false })),
  ];

  const active = db.select().from(prompts)
    .where(and(eq(prompts.brandId, brandId), eq(prompts.status, "active"))).all();
  if (!active.length) throw new Error("Add at least one active prompt first");

  const runId = randomUUID();
  db.insert(trackingRuns).values({ id: runId, brandId, trigger }).run();
  const providers = getProviders(brand.name, comps.map(c => c.name));

  for (const p of active) {
    for (const prov of providers) {
      try {
        if (!prov.isMock) await sleep(2200);
        const raw = await withRetry(() => prov.run(p.text, { locale: p.locale ?? undefined }));
        const hits = detectBrands(raw, refs);
        const own = hits.find(h => h.brandId === brandId);
        const sent = own ? scoreSentiment(raw, own.index) : null;      // Module 6
        const sources = extractCitations(raw);                         // Module 7

        const chatId = randomUUID();
        db.insert(chats).values({
          id: chatId, runId, promptId: p.id, brandId,
          platform: prov.label, locale: p.locale ?? "global", isSimulated: prov.isMock,
          rawResponse: raw,
          mentioned: !!own, position: own?.position ?? null,
          sentiment: sent?.label ?? null, sentimentScore: sent?.score ?? null,
          // store sentiment for EVERY brand hit (Module 19 needs competitor sentiment; retrofitting later forces a full re-run)
          brandsFound: JSON.stringify(hits.map(h => {
            const s = scoreSentiment(raw, h.index);
            return { brandId: h.brandId, name: h.name, position: h.position, sentiment: s.label, sentimentScore: s.score };
          })),
          citedSources: JSON.stringify(sources.map(s => s.domain)),
        }).run();
        persistSources(chatId, sources);                               // Module 7
      } catch (e: any) {
        // Record the failure and CONTINUE — one bad provider must never kill the run.
        db.insert(chats).values({
          id: randomUUID(), runId, promptId: p.id, brandId, platform: prov.label,
          isSimulated: prov.isMock, error: String(e?.message ?? e),
        }).run();
      }
    }
  }
  db.update(trackingRuns).set({ status: "completed", finishedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(trackingRuns.id, runId)).run();

  await generateRecommendations(brandId, runId);   // Module 14
  await evaluateAlerts(brandId, runId);            // Module 22
  return { runId };
}
```

### 9.3 Long runs: don't block the HTTP request
A run with 25 prompts × 6 providers + 2.2 s delays takes minutes. Two free options:
1. **Fire-and-forget + polling (recommended):** `POST /track` inserts the run row, kicks off `runTracking()` **without awaiting**, returns `{runId}` immediately; the UI polls `GET /api/runs/[id]` (status + `completedChats/totalChats`) every 2 s and shows a progress bar.
2. **`node-cron` worker** for scheduled runs (Module 22 reuses it).

> On serverless hosts (Vercel) background work after the response is killed. For long runs either deploy as a long-lived Node process (Railway/Render/Fly free tiers, or run locally for the demo) or chunk the run into one-prompt-per-request calls driven by the client.

### 9.4 Acceptance criteria
- [ ] `detectBrands("Try Monday.com or Asana", ...)` finds `Monday.com` at position 1
- [ ] Brand absent → `mentioned=false`, `position=null`
- [ ] Alias match counts as the same brand
- [ ] A throwing provider produces an `error` row, other providers still complete
- [ ] A 25-prompt run never makes the browser request time out

---

## 10. MODULE 6 — Sentiment Analysis

**Purpose:** classify the tone around the brand's mention. Being mentioned *negatively* is worse than absent; pure mention-counting misses this.
**Depends on:** Module 5. **Source:** ZeroRank sentiment score; AthenaHQ "how AI describes your brand".

### 10.1 Baseline: keyword-window scoring (free, instant, no API call)

```typescript
// src/lib/analysis/sentiment.ts
const POS = ["best","excellent","great","top","leading","recommend","trusted","reliable","popular",
  "innovative","affordable","loved","favorite","outstanding","powerful","easy to use","well-regarded","praised","fast"];
const NEG = ["worst","poor","expensive","complicated","unreliable","avoid","disappointing","buggy",
  "outdated","limited","lacking","overpriced","criticized","confusing","slow","downtime"];
const NEGATORS = ["not","no","never","isn't","aren't","don't","without","hardly"];

export type SentimentLabel = "positive" | "neutral" | "negative";

export function scoreSentiment(text: string, mentionIndex: number) {
  const window = text.slice(Math.max(0, mentionIndex - 160), mentionIndex + 260).toLowerCase();
  const tokens = window.split(/\W+/);
  let score = 0;

  const check = (list: string[], sign: 1 | -1) => {
    for (const w of list) {
      const words = w.split(" ");
      for (let i = 0; i <= tokens.length - words.length; i++) {
        if (words.every((x, j) => tokens[i + j] === x)) {
          const negated = NEGATORS.includes(tokens[i - 1] ?? "") || NEGATORS.includes(tokens[i - 2] ?? "");
          score += negated ? -sign : sign;   // "not reliable" flips polarity
        }
      }
    }
  };
  check(POS, 1);
  check(NEG, -1);

  const norm = Math.max(-1, Math.min(1, score / 4));
  const label: SentimentLabel = norm > 0.15 ? "positive" : norm < -0.15 ? "negative" : "neutral";
  return { score: Number(norm.toFixed(2)), label };
}
```

Display score for the UI: `Math.round((score + 1) / 2 * 100)` → 0–100.

### 10.2 Upgrade: LLM-as-judge (still free, uses your Groq/Gemini key)

Only when a real key exists, classify the **sentence(s) containing the brand**:

```
Classify the sentiment toward "{brand}" in the text below as positive, neutral or negative.
Reply with ONLY JSON: {"sentiment":"...","confidence":0.0-1.0,"reason":"<=12 words"}.
TEXT: {window}
```
Parse with try/catch, fall back to the keyword result on failure. Store which method produced the label (`sentiment_method` — add a column if you want it in the report).

> **Honest limitation to state in your thesis:** keyword scoring misses sarcasm and comparative framing ("X is fine, but Y is better"). The LLM-judge reduces this but is itself non-deterministic. Report both methods' agreement rate on a hand-labelled sample of ~50 responses — that single table is strong evidence of rigor.

### 10.3 Acceptance criteria
- [ ] "Acme is not reliable" scores **negative**
- [ ] No brand mention → sentiment is `null`, not "neutral"
- [ ] Hand-label 30 responses; keyword method ≥ 70% agreement (report the real number, whatever it is)

---

## 11. MODULE 7 — Citation / Source Extraction

**Purpose:** pull every domain the AI cites and classify its type — this tells users **which third-party sites the AI already trusts**.
**Depends on:** Module 5. **Source:** ZeroRank "Sources" tab; AthenaHQ's core specialty.

### 11.1 Extraction (`src/lib/analysis/citations.ts`)

```typescript
const URL_RE = /https?:\/\/[^\s)\]>"']+/gi;
const BARE_RE = /\b((?:[a-z0-9-]+\.)+(?:com|io|ai|net|org|co|dev|app|edu|gov|in|uk))\b/gi;

export interface Citation { domain: string; count: number }

export function extractCitations(text: string): Citation[] {
  const counts = new Map<string, number>();
  const bump = (d: string) => counts.set(d, (counts.get(d) ?? 0) + 1);

  for (const m of text.matchAll(URL_RE)) {
    try { bump(new URL(m[0]).hostname.replace(/^www\./, "").toLowerCase()); } catch {}
  }
  const urlDomains = new Set(counts.keys());
  for (const m of text.matchAll(BARE_RE)) {
    const d = m[1].toLowerCase();
    if (!urlDomains.has(d)) bump(d);      // don't double-count a domain already seen as a URL
  }
  return [...counts].map(([domain, count]) => ({ domain, count }));
}
```

### 11.2 Domain type classification (static lookup + heuristics)

```typescript
const TYPES: Record<string, string[]> = {
  review:   ["g2.com","capterra.com","trustpilot.com","softwareadvice.com","gartner.com","trustradius.com"],
  forum:    ["reddit.com","quora.com","news.ycombinator.com","stackoverflow.com","stackexchange.com"],
  social:   ["linkedin.com","twitter.com","x.com","youtube.com","facebook.com","medium.com"],
  news:     ["techcrunch.com","forbes.com","theverge.com","wired.com","bloomberg.com","reuters.com"],
  reference:["wikipedia.org","github.com","docs.github.com"],
};

export function classifyDomain(domain: string, ownDomains: string[] = []): string {
  if (ownDomains.some(o => domain === o || domain.endsWith("." + o))) return "own";
  for (const [type, list] of Object.entries(TYPES))
    if (list.some(d => domain === d || domain.endsWith("." + d))) return type;
  if (/^(docs|developer|developers|support|help)\./.test(domain)) return "docs";
  return "other";
}
```
Persist unique domains into `sources` and link them with `chat_sources`:

```typescript
export function persistSources(chatId: string, cites: Citation[]) {
  for (const c of cites) {
    let src = db.select().from(sources).where(eq(sources.domain, c.domain)).get();
    if (!src) {
      const id = randomUUID();
      db.insert(sources).values({ id, domain: c.domain, type: classifyDomain(c.domain) }).run();
      src = { id, domain: c.domain, type: classifyDomain(c.domain) };
    }
    db.insert(chatSources).values({ chatId, sourceId: src.id, citationCount: c.count }).run();
  }
}
```

### 11.3 A real limitation you must know (and say out loud)
Groq/Gemini **plain chat APIs do not return structured citations** — they only return prose, so domains appear only when the model happens to write them. Search-grounded products (Perplexity, ChatGPT Search, Google AI Overviews) return real citation lists. Mitigation options, all free:
- Add to the prompt: *"When you recommend something, mention the website you'd verify it on."* — increases citation yield but slightly changes the measurement; keep it as a **toggle** and record which mode each run used.
- Gemini supports **Google Search grounding** on its free tier in some regions/models; if available, its `groundingMetadata` contains real source URLs — prefer that when present.
Document which mode produced each chat. Never mix the two modes in one trend line without labelling it.

### 11.4 Acceptance criteria
- [ ] `https://www.g2.com/products/x` and a bare `g2.com` mention in one response count as **one** domain (the URL form is counted; the bare mention is skipped)
- [ ] `reddit.com` classifies as `forum`, `docs.stripe.com` as `docs`
- [ ] Re-running never creates duplicate `sources` rows (UNIQUE on domain)

---

## 12. MODULE 8 — Content Compatibility Score

**Purpose:** score any piece of content on structural features that research links to being cited by LLMs. Turns "add an FAQ" from vague advice into a measurable, re-testable number.
**Depends on:** Module 2. **Source:** Otterly's GEO audit idea; features grounded in Aşkın & Baykara (2026) — readability and FAQ-structure positively associated with citation, numeric-density and heavy citation markers negatively associated *in their in-context experiment*.

> **Scientific honesty:** those findings come from one model (GPT-4o) in an *in-context* setting and contradict some earlier GEO claims (Aggarwal et al. found stats/quotes helped). Present the score as **"features associated with citation in the literature"**, not as a guarantee. Offer the replication experiment (Section 27) to test it yourself — that is your real contribution.

### 12.1 Feature extraction (pure JS, no dependency) — `src/lib/analysis/content-features.ts`

```typescript
export interface ContentFeatures {
  wordCount: number; sentenceCount: number; avgSentenceLen: number;
  questionCount: number; faqPairs: number; headingCount: number; bulletCount: number;
  numericRatio: number; fleschReadingEase: number; hasSchemaJsonLd: boolean;
  entityDensity: number; passiveRatio: number;
}

const syllables = (w: string) => {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const m = w.replace(/e$/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
};

export function extractFeatures(raw: string): ContentFeatures {
  const hasSchemaJsonLd = /application\/ld\+json/i.test(raw);
  const text = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 2);
  const questions = sentences.filter(s => s.trim().endsWith("?"));

  const faqPairs = questions.filter((q, i) => sentences[sentences.indexOf(q) + 1] && !sentences[sentences.indexOf(q) + 1].endsWith("?")).length;
  const numericTokens = words.filter(w => /\d/.test(w)).length;
  const syl = words.reduce((a, w) => a + syllables(w), 0);
  const asl = words.length / Math.max(1, sentences.length);
  const asw = syl / Math.max(1, words.length);

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    avgSentenceLen: Number(asl.toFixed(1)),
    questionCount: questions.length,
    faqPairs,
    headingCount: (raw.match(/<h[1-4][\s>]|^#{1,4}\s/gim) ?? []).length,
    bulletCount: (raw.match(/<li[\s>]|^\s*[-*•]\s/gim) ?? []).length,
    numericRatio: Number((numericTokens / Math.max(1, words.length)).toFixed(3)),
    fleschReadingEase: Number((206.835 - 1.015 * asl - 84.6 * asw).toFixed(1)),
    hasSchemaJsonLd,
    entityDensity: Number(((text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g) ?? []).length / Math.max(1, sentences.length)).toFixed(2)),
    passiveRatio: Number(((text.match(/\b(is|are|was|were|been|being)\s+\w+ed\b/gi) ?? []).length / Math.max(1, sentences.length)).toFixed(2)),
  };
}
```

### 12.2 Scoring (transparent weights, every point explained)

```typescript
export function scoreContent(f: ContentFeatures) {
  const checks: Array<{ ok: boolean; pts: number; label: string; fix: string }> = [
    { ok: f.faqPairs >= 3,            pts: 20, label: "FAQ-style Q&A pairs (≥3)",        fix: "Add a short FAQ section with 3–5 real buyer questions and direct answers." },
    { ok: f.fleschReadingEase >= 50,  pts: 20, label: "Readable (Flesch ≥ 50)",          fix: "Shorten sentences and replace jargon." },
    { ok: f.avgSentenceLen <= 22,     pts: 10, label: "Sentences ≤ 22 words avg",        fix: "Split long sentences." },
    { ok: f.numericRatio <= 0.06,     pts: 10, label: "Not statistics-dense",            fix: "Move dense number tables out of the main prose." },
    { ok: f.headingCount >= 3,        pts: 10, label: "Clear headings (≥3)",             fix: "Add descriptive H2/H3 headings." },
    { ok: f.bulletCount >= 3,         pts: 5,  label: "Bullet/list structure",           fix: "Convert comparisons into bullet lists." },
    { ok: f.hasSchemaJsonLd,          pts: 15, label: "schema.org JSON-LD present",      fix: "Add Organization / Product / FAQPage JSON-LD." },
    { ok: f.wordCount >= 300,         pts: 5,  label: "Enough substance (≥300 words)",   fix: "Expand with specifics a buyer would need." },
    { ok: f.passiveRatio <= 0.25,     pts: 5,  label: "Mostly active voice",             fix: "Rewrite passive sentences actively." },
  ];
  const score = checks.reduce((a, c) => a + (c.ok ? c.pts : 0), 0);
  return { score, passed: checks.filter(c => c.ok), failed: checks.filter(c => !c.ok) };
}
```

### 12.3 Routes & UI
- `POST /api/brands/[id]/content-score` `{label?, content?, url?}` — if `url`, fetch server-side (Module 17's safe fetcher), then extract + score + save to `content_scores`.
- UI: paste box → big score ring → ✓ passed list → ✗ failed list with the **fix** text. Re-scoring a rewritten draft and showing the delta is the demo moment.

### 12.4 Acceptance criteria
- [ ] A 5-question FAQ page scores higher than a wall of statistics
- [ ] Every failed check shows its specific `fix`
- [ ] Re-scoring after edits shows before → after score

---

## 13. MODULES 9–13 — The Dashboard Layer (Visibility, Sentiment, Share of Voice, Chats, Sources)

These five modules are all **read-only views over the `chats` table**. Build the shared analytics layer once (13.1), then each module is just a chart/table on top of it.
**Depends on:** Modules 5–7.

### 13.1 Shared analytics service (`src/lib/analytics.ts`)

All numbers in the product must come from **one** place so they can never disagree between pages. Define the metrics once:

| Metric | Definition (use exactly this everywhere) |
|---|---|
| **Visibility %** | `chats WHERE mentioned=1` ÷ `chats WHERE error IS NULL`, within scope (brand + run/date-range + optional platform/prompt filter). Simulated rows excluded unless the user toggles "include simulated". |
| **Avg. Rank** | mean of `position` over rows where `mentioned=1` (lower is better; can be fractional, e.g. #2.6) |
| **Sentiment score (0–100)** | mean of `(sentiment_score+1)/2*100` over mentioned rows |
| **Share of Voice** | for each brand: rows whose `brands_found` includes it ÷ total rows |

```typescript
export interface Scope {
  brandId: string;
  from?: string; to?: string;          // ISO dates
  platform?: string; promptId?: string;
  includeSimulated?: boolean;
}

function whereClause(s: Scope) {
  const w = ["c.brand_id = @brandId", "c.error IS NULL"];
  if (!s.includeSimulated) w.push("c.is_simulated = 0");
  if (s.from) w.push("c.created_at >= @from");
  if (s.to) w.push("c.created_at <= @to");
  if (s.platform) w.push("c.platform = @platform");
  if (s.promptId) w.push("c.prompt_id = @promptId");
  return w.join(" AND ");
}

export function visibilityByRun(s: Scope) {
  return sqlite.prepare(`
    SELECT r.id AS runId, r.started_at AS date,
           COUNT(*) AS total,
           SUM(c.mentioned) AS mentioned,
           ROUND(100.0 * SUM(c.mentioned) / COUNT(*), 1) AS visibility,
           ROUND(AVG(CASE WHEN c.mentioned=1 THEN c.position END), 2) AS avgRank
    FROM chats c JOIN tracking_runs r ON r.id = c.run_id
    WHERE ${whereClause(s)}
    GROUP BY r.id ORDER BY r.started_at ASC`).all(s);
}

export function sentimentBreakdown(s: Scope) {
  return sqlite.prepare(`
    SELECT c.sentiment AS label, COUNT(*) AS n
    FROM chats c WHERE ${whereClause(s)} AND c.mentioned = 1
    GROUP BY c.sentiment`).all(s);
}

export function visibilityByPlatform(s: Scope) {
  return sqlite.prepare(`
    SELECT c.platform, COUNT(*) AS total, SUM(c.mentioned) AS mentioned,
           ROUND(100.0 * SUM(c.mentioned)/COUNT(*), 1) AS visibility
    FROM chats c WHERE ${whereClause(s)} GROUP BY c.platform`).all(s);
}

/** Share of voice: parse brands_found JSON in JS (SQLite JSON1 also works: json_each). */
export function shareOfVoice(s: Scope) {
  const rows = sqlite.prepare(`SELECT c.brands_found FROM chats c WHERE ${whereClause(s)}`).all(s) as any[];
  const total = rows.length || 1;
  const tally = new Map<string, { name: string; hits: number; posSum: number }>();
  for (const r of rows) {
    for (const b of JSON.parse(r.brands_found || "[]")) {
      const t = tally.get(b.brandId) ?? { name: b.name, hits: 0, posSum: 0 };
      t.hits++; t.posSum += b.position; tally.set(b.brandId, t);
    }
  }
  return [...tally].map(([brandId, t]) => ({
    brandId, name: t.name,
    visibility: Math.round((100 * t.hits) / total),
    avgRank: Number((t.posSum / t.hits).toFixed(1)),
  })).sort((a, b) => b.visibility - a.visibility);
}
```

> **Prepared statements with `@named` params** are used so user-supplied filters can never inject SQL. Never string-concatenate a filter value into SQL.

### 13.2 One aggregated endpoint
`GET /api/brands/[id]/overview?from&to&platform&includeSimulated` returns `{ trend, sentiment, platforms, shareOfVoice, topSources, recentChats, lastRunAt }`. One request → whole dashboard, fewer round trips.

---

### MODULE 9 — Visibility Trend Chart
**Source:** ZeroRank Overview / Otterly / Peec (universal).
- Recharts `LineChart`, x = run date, y = visibility %, **one line per brand** (yours amber/emphasised, competitors muted). Competitor lines come from running `shareOfVoice` per run — add `GROUP BY run`.
- Add a **7-run moving average** toggle: LLM output is noisy, a single run swings a lot, smoothing is honest, not cosmetic.
- Show **n** (number of answers) in the tooltip. A 40% from 5 answers and 40% from 500 are not the same claim.
- Empty state: *"Run tracking to see your first data point"* — never an empty axis.

```tsx
<ResponsiveContainer width="100%" height={260}>
  <LineChart data={trend}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" tickFormatter={d => format(new Date(d), "MMM d")} />
    <YAxis domain={[0, 100]} unit="%" />
    <Tooltip formatter={(v: number, _n, p) => [`${v}% (n=${p.payload.total})`, "Visibility"]} />
    <Line type="monotone" dataKey="visibility" strokeWidth={2} dot />
  </LineChart>
</ResponsiveContainer>
```

### MODULE 10 — Sentiment Breakdown
**Source:** ZeroRank Overview (sentiment dot + score).
- Donut/stacked bar of positive/neutral/negative **among mentioned rows only**. Also show the headline 0–100 score and a per-brand sentiment column in the Ranking table (Module 19).
- Click a slice → navigates to Chats (Module 12) pre-filtered by that sentiment. Charts that cannot be drilled into are decoration.

### MODULE 11 — Competitor Share of Voice
**Source:** Peec AI's specialty.
- Horizontal bar chart from `shareOfVoice()`; own brand highlighted. Show visibility % **and** avg rank per bar.
- Add a "vs. you" delta column (competitor % − your %) so the gap is explicit.

### MODULE 12 — Chats Log (raw evidence viewer)
**Source:** ZeroRank "Chats" tab. **Why it matters:** this is the audit trail — any chart can be drilled down to the exact AI text that produced it. It is what makes the product trustworthy and defensible in a viva.
- Left: list grouped by prompt (topic folder → prompt → N answers), searchable. Right: timeline for the selected prompt — each run's answer per platform.
- Render the raw answer with **brand names highlighted inline**: own brand amber, competitors muted. Implement by splitting the text on the combined alias regex and wrapping matches in `<mark>`.
- Filters: platform, mentioned/not, sentiment, date, simulated/real. Show a **"simulated"** pill on mock rows.
- Pagination (50/page) — raw responses are big.

```tsx
function Highlighted({ text, own, rivals }: { text: string; own: string[]; rivals: string[] }) {
  const all = [...own, ...rivals].map(esc).join("|");
  const parts = text.split(new RegExp(`(${all})`, "gi"));
  return <>{parts.map((p, i) =>
    own.some(o => o.toLowerCase() === p.toLowerCase()) ? <mark key={i} className="bg-amber-200">{p}</mark>
    : rivals.some(r => r.toLowerCase() === p.toLowerCase()) ? <mark key={i} className="bg-slate-200">{p}</mark>
    : p)}</>;
}
```

### MODULE 13 — Sources View
**Source:** ZeroRank "Sources" tab; AthenaHQ. **Highest-leverage table in the product:** it tells you exactly where to get listed.
- Table: Domain · Type badge · **Used %** (share of answers citing it) · **Avg citations per answer** · "cited alongside": which brands appear in the same answers.
- Two tabs: **Domains** (aggregated) and **URLs** (if you have full URLs).
- **Gap Analysis filter** (ZeroRank has this): show domains that cite competitors but never you → direct to-do list.
- Domain-type donut (review/forum/docs/news/social/own/other) with total citation count.

```sql
-- Used % for each domain within scope
SELECT s.domain, s.type,
       COUNT(DISTINCT cs.chat_id) AS answers,
       ROUND(100.0 * COUNT(DISTINCT cs.chat_id) / (SELECT COUNT(*) FROM chats c WHERE <scope>), 1) AS usedPct,
       ROUND(AVG(cs.citation_count), 1) AS avgCitations
FROM chat_sources cs
JOIN sources s ON s.id = cs.source_id
JOIN chats c   ON c.id = cs.chat_id
WHERE <scope>
GROUP BY s.id ORDER BY answers DESC LIMIT 50;
```

### Acceptance criteria (Modules 9–13)
- [ ] Every number on Overview equals the number you get by hand-counting the Chats list for the same filter
- [ ] Changing the date range updates **all** five widgets consistently
- [ ] Simulated data is excluded by default and clearly labelled when included
- [ ] Clicking any chart element drills into the underlying chats
- [ ] Empty states exist for: no brand, no prompts, no runs, no mentions

---

## 14. MODULE 14 — Recommendation Engine (rule-based, explainable)

**Purpose:** convert tracked numbers into prioritised actions. This is what separates a dashboard from a useful product — and the place your project can claim a real contribution.
**Depends on:** Modules 5–13. **Source:** ZeroRank Off-Page/On-Page/Technical tabs; AthenaHQ Action Center; Otterly recommendations.

### 14.1 Design principle
Every recommendation stores an **`evidence` JSON** — the exact figures that triggered it — and a **`rationale`** that cites *why the rule exists*. The UI shows both. That is the difference from the black-box tools.

### 14.2 Three categories (fixed — UI filters rely on them)
- **Off-page / Authority** — third-party presence (review sites, forums, listings)
- **On-page / Content** — pages and wording on your own site
- **Technical** — crawlability, schema, speed

### 14.3 Rule catalogue

| # | Condition (computed from your data) | Category | Priority | Action |
|---|---|---|---|---|
| R1 | visibility < 30% | content | high | Publish pages that directly answer your tracked prompts (comparison, "best X for Y", FAQ) |
| R2 | mentioned but `cited_sources` empty in ≥ 50% of your mentions | authority | medium | Get listed on the high-usage domains from Sources |
| R3 | negative sentiment share > 20% of your mentions | content | high | Publish content addressing the objection pattern found in the negative answers (extract recurring words from those rows) |
| R4 | a domain cites ≥ 2 competitors and never you (Gap Analysis) | authority | high | Pursue a listing/mention on that domain |
| R5 | a prompt where a competitor is mentioned in ≥ 60% of answers and you in 0% | content | high | Build a dedicated page for that prompt topic |
| R6 | forum domains (reddit/quora) are ≥ 20% of citations and you have none | authority | medium | Participate **genuinely** in those threads (Discovery Feed, Module 16) |
| R7 | visibility fell ≥ 10 pts across the last 2 runs | content | medium | Open Chats, inspect what changed |
| R8 | your site's crawl audit score < 60 (Module 17) | technical | high | Fix the failing checks |
| R9 | no JSON-LD / FAQ schema detected on your site | technical | medium | Add Organization + FAQPage JSON-LD |
| R10 | your avg rank > 3 when mentioned | content | low | Strengthen differentiators so you're named earlier |
| R11 | all healthy | authority | low | Maintain: keep content fresh, keep monitoring |

### 14.4 Implementation pattern

```typescript
// src/lib/recommendations.ts
type Rec = {
  category: "content" | "authority" | "technical";
  priority: "high" | "medium" | "low";
  title: string; detail: string; evidence: Record<string, unknown>;
};

export async function generateRecommendations(brandId: string, runId: string) {
  const scope = { brandId, includeSimulated: false } as Scope;
  const trend = visibilityByRun(scope) as any[];
  const latest = trend.at(-1);
  const recs: Rec[] = [];

  if (latest && latest.visibility < 30) recs.push({
    category: "content", priority: "high",
    title: "Low AI visibility — publish buyer-intent content",
    detail: `You appeared in ${latest.visibility}% of tracked answers. Publish pages that answer your tracked prompts directly (comparison pages, "best X for Y", FAQs) so retrieval systems have something clear to cite.`,
    evidence: { visibility: latest.visibility, answers: latest.total, rule: "R1" },
  });

  // R4 — gap analysis: domains citing >=2 competitors but never us
  const gaps = sqlite.prepare(`...`).all(/* see SQL below */);
  for (const g of gaps.slice(0, 3)) recs.push({
    category: "authority", priority: "high",
    title: `Get mentioned on ${g.domain}`,
    detail: `${g.domain} was cited in ${g.answers} answers that named competitors, and never alongside you.`,
    evidence: { domain: g.domain, answers: g.answers, rule: "R4" },
  });

  // ...implement R2, R3, R5-R11 the same way

  // De-duplicate against currently OPEN recs (same rule + same subject) so reruns don't spam
  persistIfNew(brandId, runId, recs);
  return recs;
}
```

Gap SQL (R4):
```sql
SELECT s.domain, COUNT(DISTINCT cs.chat_id) AS answers
FROM chat_sources cs
JOIN sources s ON s.id = cs.source_id
JOIN chats c ON c.id = cs.chat_id
WHERE c.brand_id = @brandId AND c.mentioned = 0 AND c.is_simulated = 0
  AND json_array_length(c.brands_found) >= 1
GROUP BY s.id HAVING answers >= 2
ORDER BY answers DESC;
```

### 14.5 Make it *evidence-grounded* (your differentiator)
Add a `basis` field to each rule linking to a source:
- R9/schema → *Uppin & Uppin (2025): schema/JSON-LD aids LLM extraction*
- R1/FAQ → *Aşkın & Baykara (2026): FAQ-structured content cited most (83.4%) in their experiment*
- R4/R6 → *Chen & Wang (2025) via Aşkın & Baykara: generative engines favour independent third-party sources over brand sites*

Render a small **"Why this rule?"** expander on each card. Be honest in wording: *"associated with"*, not *"causes"*.

### 14.6 Status workflow
`open → in_progress → done` (PATCH). When a run later shows the metric recovered, auto-suggest closing the rec. Track `done` recs against the next runs' visibility — that is your before/after case study data (Section 28).

### 14.7 Acceptance criteria
- [ ] Each rec shows the exact numbers that triggered it
- [ ] Re-running tracking does **not** create duplicate open recs
- [ ] Every rule has a testable fixture (insert synthetic chats → assert the rec appears)
- [ ] Marking `done` persists and hides it from the default list

---

## 15. MODULE 15 — Gap Opportunities

**Purpose:** show prompts where competitors are named and you are not — the single highest-leverage view in the product ("where exactly am I losing?").
**Depends on:** Modules 5, 9–11. **Source:** ZeroRank "Gap Opportunities".

### 15.1 Scoring

For each active prompt `p` over the selected scope:
```
yourRate(p)   = answers where you are mentioned ÷ answers for p
rivalRate(p,c)= answers where competitor c is mentioned ÷ answers for p
gap(p,c)      = rivalRate(p,c) × (1 − yourRate(p))
opportunity(p)= max over competitors of gap(p,c)       // dominant rival defines the gap
```
Sort descending. Optional multiplier `weight(p)` (default 1.0) — if you later add a search-volume source, plug it in here; do **not** invent volumes.

```typescript
export function gapOpportunities(scope: Scope) {
  const rows = sqlite.prepare(`
    SELECT c.prompt_id AS promptId, p.text AS prompt, c.mentioned, c.brands_found
    FROM chats c JOIN prompts p ON p.id = c.prompt_id
    WHERE ${whereClause(scope)}`).all(scope) as any[];

  const byPrompt = new Map<string, { prompt: string; n: number; you: number; rivals: Map<string, { name: string; hits: number }> }>();
  for (const r of rows) {
    const e = byPrompt.get(r.promptId) ?? { prompt: r.prompt, n: 0, you: 0, rivals: new Map() };
    e.n++; if (r.mentioned) e.you++;
    for (const b of JSON.parse(r.brands_found || "[]")) {
      if (b.brandId === scope.brandId) continue;
      const x = e.rivals.get(b.brandId) ?? { name: b.name, hits: 0 };
      x.hits++; e.rivals.set(b.brandId, x);
    }
    byPrompt.set(r.promptId, e);
  }

  return [...byPrompt].map(([promptId, e]) => {
    const yourRate = e.you / e.n;
    const top = [...e.rivals.values()].sort((a, b) => b.hits - a.hits)[0];
    const rivalRate = top ? top.hits / e.n : 0;
    return { promptId, prompt: e.prompt, answers: e.n,
      yourRate: Math.round(yourRate * 100), topRival: top?.name ?? null,
      rivalRate: Math.round(rivalRate * 100),
      opportunity: Number((rivalRate * (1 - yourRate)).toFixed(3)) };
  }).filter(g => g.opportunity > 0).sort((a, b) => b.opportunity - a.opportunity);
}
```

### 15.2 UI
Table: Prompt · You % · Top rival (+%) · Opportunity bar · **[Generate brief]** (Module 18) · **[Find discussions]** (Module 16 pre-filled with this prompt). Minimum-sample guard: hide rows with `answers < 3` (or show greyed "low data") — a gap from one answer is noise.

### 15.3 Acceptance criteria
- [ ] A prompt where you are 100% visible never appears
- [ ] Sorted by opportunity, ties broken by answer count
- [ ] "Generate brief" carries the prompt + rival context into Module 18

---

## 16. MODULE 16 — Discovery Feed (ToS-safe social listening)

**Purpose:** surface real public discussions matching your tracked prompts, so a **human** can participate genuinely. Based on the finding that generative engines lean on third-party discussion/review content, not just brand sites.
**Depends on:** Modules 3, 15. **Source:** the legitimate half of CrowdReply's "Engagement Engine".

> **Hard rule — written into the product, not just the docs:** this module **only discovers and displays**. It must never auto-post, auto-reply, generate fake accounts, or schedule comments. Posting through managed/shadow accounts violates Reddit's and Quora's terms and is astroturfing. Show a one-line banner in the UI: *"Read the thread, then reply as yourself if you genuinely have something useful to add."*

### 16.1 Source options (all free) — build the adapter interface, ship ≥ 2

```typescript
export interface DiscoverySource {
  id: string;
  search(query: string): Promise<Array<{
    title: string; url: string; community?: string;
    score: number; comments: number; createdAt?: string;
  }>>;
}
```

**(a) Reddit official API (OAuth, app-only).** Register a free "script/web app" at reddit.com/prefs/apps. 
> **Honest caveat:** Reddit tightened API approval in recent years; new registrations may require applying and approval, and rate limits are strict (~100 req/min for authenticated clients with a proper `User-Agent`). Always set a descriptive `User-Agent`, e.g. `web:echorank:v1.0 (by /u/yourname)`.

```typescript
async function redditToken() {
  const basic = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded",
               "User-Agent": "web:echorank:v1.0" },
    body: "grant_type=client_credentials",
  });
  return (await r.json()).access_token as string;
}

export const reddit: DiscoverySource = {
  id: "reddit",
  async search(q) {
    const token = await redditToken();
    const r = await fetch(`https://oauth.reddit.com/search?q=${encodeURIComponent(q)}&sort=relevance&t=year&limit=25&type=link`,
      { headers: { Authorization: `Bearer ${token}`, "User-Agent": "web:echorank:v1.0" } });
    const j = await r.json();
    return (j.data?.children ?? []).map((c: any) => ({
      title: c.data.title, url: `https://www.reddit.com${c.data.permalink}`,
      community: c.data.subreddit_name_prefixed, score: c.data.score, comments: c.data.num_comments,
      createdAt: new Date(c.data.created_utc * 1000).toISOString(),
    }));
  },
};
```

**(b) Hacker News — Algolia API.** Free, **no key, no signup** — a reliable fallback and great for tech/SaaS categories:
`GET https://hn.algolia.com/api/v1/search?query=<q>&tags=story&hitsPerPage=25` → `hits[].{title,url,points,num_comments,objectID}`; discussion URL = `https://news.ycombinator.com/item?id=<objectID>`.

**(c) Stack Exchange API.** Free without a key at low volume: `GET https://api.stackexchange.com/2.3/search/advanced?q=<q>&site=stackoverflow&order=desc&sort=relevance` (consider other sites for non-dev categories).

### 16.2 Turning a prompt into a good search query
Raw prompts like "What is the best CRM for a 10-person startup?" search poorly. Extract keywords:
```typescript
const STOP = new Set(["what","is","the","best","for","a","an","in","to","of","and","how","which","are","do","i","my","with","on"]);
export const toQuery = (p: string) =>
  p.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w)).slice(0, 6).join(" ");
```

### 16.3 Relevance ranking (transparent, no ML)
```
relevance = 0.5 * norm(log1p(comments)) + 0.3 * norm(log1p(score)) + 0.2 * recency
recency   = exp(-ageDays / 365)
```
Boost ×1.25 when the thread title/body mentions a **competitor** name (people comparing options are exactly the conversations AI tends to summarise). Store in `discovery_items.relevance`; UNIQUE(brand_id, url) prevents duplicates across refreshes.

### 16.4 Routes & UI
- `POST /api/brands/[id]/discovery/refresh` — for each active prompt (cap 10 per refresh) run each enabled source, upsert items.
- `GET /api/brands/[id]/discovery?status=new|saved|dismissed`.
- `PATCH .../[itemId]` `{status}`.
- UI: card list — title, community, score/comments, **why shown** ("matches prompt: …", "mentions Competitor X"), buttons **Open ↗ / Save / Dismiss**. No "reply" button, ever.

### 16.5 Acceptance criteria
- [ ] Works with **no Reddit credentials** (falls back to HN/StackExchange, no crash)
- [ ] Refreshing twice never creates duplicates
- [ ] Respects rate limits (sequential requests, ≥ 1 s apart, descriptive User-Agent)
- [ ] There is no code path that writes to any external site

---

## 17. MODULE 17 — Crawlability Checker (AI-readiness audit)

**Purpose:** scan a page and report *why AI crawlers/retrievers might skip it* — before you publish more content that never gets seen.
**Depends on:** Module 2. **Source:** Otterly's "Crawlability Checker / GEO audit".
**Be upfront in your report:** this is a lightweight approximation, not a Screaming-Frog-class crawler.

### 17.1 SSRF protection (mandatory — you are fetching user-supplied URLs server-side)

```typescript
// src/lib/safe-fetch.ts
import dns from "dns/promises";
import net from "net";

function isPrivate(ip: string) {
  if (net.isIPv6(ip)) return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 169 && b === 254);
}

export async function safeFetch(url: string, init: RequestInit = {}, timeoutMs = 8000) {
  const u = new URL(url);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http(s) allowed");
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (addrs.some(a => isPrivate(a.address))) throw new Error("Blocked: private address");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(u, { ...init, signal: ctrl.signal, redirect: "follow",
      headers: { "User-Agent": "EchoRankBot/1.0 (+audit)", ...(init.headers ?? {}) } });
  } finally { clearTimeout(t); }
}
```
> Without this guard, anyone could make your server fetch `http://localhost`, cloud metadata endpoints, or your internal network. Treat it as non-negotiable.

### 17.2 The checks

| # | Check | How | Points |
|---|---|---|---|
| 1 | Reachable, 200 status | `safeFetch(url)` | 10 |
| 2 | Response time | ms to first byte/full body; AI retrievers use short timeouts (~1–5 s per the Rajagukguk et al. review) → pass < 1500 ms | 10 |
| 3 | `robots.txt` allows AI bots | fetch `/robots.txt`, parse `User-agent` groups for **GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, CCBot**; flag `Disallow: /` | 20 |
| 4 | No `noindex` | `<meta name="robots">` + `X-Robots-Tag` header | 10 |
| 5 | Content present without JavaScript | strip `<script>`; text words in raw HTML ≥ 150 (many AI crawlers don't execute JS) | 15 |
| 6 | Title + meta description + canonical | regex on HTML | 10 |
| 7 | Headings structure | exactly one `<h1>`, ≥ 2 `<h2>` | 5 |
| 8 | JSON-LD structured data | `application/ld+json`, note types found (Organization/Product/FAQPage) | 10 |
| 9 | `sitemap.xml` reachable | fetch `/sitemap.xml` | 5 |
| 10 | `llms.txt` present | fetch `/llms.txt` | 5 |

Total 100. Every failed check returns a human-readable `fix`.

```typescript
export async function auditUrl(url: string) {
  const t0 = Date.now();
  const res = await safeFetch(url);
  const html = await res.text();
  const ms = Date.now() - t0;
  const origin = new URL(res.url).origin;
  const checks: Check[] = [];

  checks.push({ id: "status", ok: res.status === 200, pts: 10, detail: `HTTP ${res.status}`,
    fix: "Make sure the page returns 200 to bots." });
  checks.push({ id: "speed", ok: ms < 1500, pts: 10, detail: `${ms} ms`,
    fix: "Improve server response time / caching; slow pages may be dropped by AI retrievers." });

  const robots = await safeFetch(`${origin}/robots.txt`).then(r => r.ok ? r.text() : "").catch(() => "");
  const blocked = AI_BOTS.filter(bot => isBlockedFor(robots, bot));
  checks.push({ id: "robots", ok: blocked.length === 0, pts: 20,
    detail: blocked.length ? `Blocked: ${blocked.join(", ")}` : "No AI bot blocked",
    fix: "Allow AI crawlers you want citations from in robots.txt (decide per bot — blocking is a business choice)." });
  // ...implement 4–10 the same way, then:
  const score = checks.reduce((a, c) => a + (c.ok ? c.pts : 0), 0);
  return { url: res.url, score, checks };
}
```

`isBlockedFor(robots, bot)`: split into groups by `User-agent:` lines; the group for the bot (or `*` if none) is blocked if it contains `Disallow: /` with nothing more specific allowing `/`.

> **Do not frame blocking as always bad.** Some brands intentionally block AI training crawlers. The audit should say *"GPTBot is blocked — you will not be cited by ChatGPT Search/training. Intentional?"*, not scold.

### 17.3 Routes & UI
`POST /api/brands/[id]/crawl-audit {url}` → save to `crawl_audits`, return result. UI: score ring + ✓/✗ checklist with detail and fix; history list so users can re-audit after fixing and see the score move.

### 17.4 Acceptance criteria
- [ ] `http://localhost` and `http://169.254.169.254` are **rejected**
- [ ] A site that returns an empty `<div id="root">` fails check 5
- [ ] A `robots.txt` with `User-agent: GPTBot / Disallow: /` is flagged
- [ ] Network failure returns a readable error, not a 500

---

## 18. MODULE 18 — Content Brief Generator

**Purpose:** turn a gap into an actionable writing brief — closes the loop from *"you're missing here"* to *"here's exactly what to write."*
**Depends on:** Modules 8, 14, 15. **Source:** Otterly.ai content-brief idea.

### 18.1 Inputs the brief is built from (all from your own tracked data)
- The **prompt** (user's real buyer question)
- **Rival(s)** appearing for it and how they're described (extract sentences mentioning the rival from stored chats)
- **Domains cited** for that prompt (Sources)
- Your brand name/site/industry
- Optional: the text of an existing page to improve (feeds Module 8's failed checks)

### 18.2 Two-tier generation
**Tier 1 — deterministic skeleton (works with no API key):**
```
# Brief: {prompt}
Goal: be the clear answer when someone asks "{prompt}"
1. Title suggestion: "{Industry}: {short answer} — {Brand} vs {Rival}"
2. Direct-answer paragraph (40–60 words) placed FIRST
3. H2 sections: {derived from rival descriptions + sub-questions}
4. FAQ block — 4 questions (derived from prompt variants), 1–3 sentence answers each
5. Comparison table: you vs {rivals} on criteria found in the rival snippets
6. Schema: FAQPage + Organization JSON-LD (see Module 17)
7. Third-party presence to build: {top cited domains for this prompt}
8. Style rules (from Module 8): short sentences, plain prose, avoid number-dense paragraphs
```
**Tier 2 — LLM enrichment (Groq/Gemini free key):**
```
You are a content strategist. Using ONLY the facts below, write a content brief for a page
that should be the best answer to: "{prompt}".
Brand: {brand} ({website}). Rivals seen in AI answers: {rivals}.
How AI described the rivals: {snippets}
Sites AI cited: {domains}
Output sections: Title, Direct answer (≤60 words), Outline (H2s), 4 FAQs with 2-sentence answers,
Comparison criteria, Schema to add, Third-party listings to pursue.
Do not invent statistics or claims about {brand}; mark unknown facts as [FILL IN].
```
> The **`[FILL IN]` instruction is important** — it stops the model fabricating features/stats about the brand, which would be harmful if published.

### 18.3 Routes & UI
`POST /api/brands/[id]/briefs {promptId}` → generate, save to `content_briefs`, return markdown. UI: rendered markdown + **Copy** + **Download .md** + "Score my draft" link to Module 8.

### 18.4 Acceptance criteria
- [ ] Works fully with no API key (Tier 1)
- [ ] Brief references the actual rival and domains from this prompt's data
- [ ] Output never states unverified facts about the user's brand

---

## 19. MODULE 19 — Ranking Comparison Page

**Purpose:** direct brand-vs-brand table. **Source:** ZeroRank "Ranking" tab / Peec.
**Depends on:** Modules 9–11.

### 19.1 Table
| Brand | Visibility % | Δ vs previous period | Sentiment (0–100) | Avg. Rank | Mentions |
|---|---|---|---|---|---|
- Your row pinned/badged **You**; rest sorted by visibility.
- **Δ** = visibility in selected period − visibility in the equal-length period immediately before (↑ green / ↓ red / – flat). Show "n/a" if the previous period has no data.
- Sentiment per brand requires computing sentiment for **competitor** mentions too. Extend Module 5's loop: for each hit in `hits`, call `scoreSentiment(raw, hit.index)` and store it in `brands_found` (`[{brandId,name,position,sentiment}]`). Add this to the stored JSON from day one — retrofitting it later forces a re-run of everything.

### 19.2 Optional radar chart
4–6 brands across Visibility / Sentiment / Mentions / inverse-Rank (`100 - rank*10`, clamped). Recharts `RadarChart`.

### 19.3 Acceptance criteria
- [ ] Δ compares equal-length windows
- [ ] Competitor sentiment populated (requires the Module 5 extension above)
- [ ] CSV export of the table

---

## 20. MODULE 20 — Tags

**Purpose:** label prompts (e.g. `high-intent`, `pricing`, `comparison`) and filter/report by them across every view. **Source:** ZeroRank "Tags".
**Depends on:** Module 3.

- Tags are **per user** (`UNIQUE(user_id, name)`), attached via `prompt_tags`.
- Routes: `GET/POST /api/tags`, `POST/DELETE /api/prompts/[id]/tags`.
- UI: inline "+ Add tag" chip editor on each prompt row with autocomplete; a **tag filter** in the global top bar.
- Make tags a first-class `Scope` filter: add `tagId?: string` to `Scope` and in `whereClause` use
  `c.prompt_id IN (SELECT prompt_id FROM prompt_tags WHERE tag_id=@tagId)`. Then **every chart and table filters by tag for free**.
- Report value: "Visibility on *pricing* prompts is 12% vs 48% on *how-to* prompts" is exactly the kind of insight tags enable.

### Acceptance criteria
- [ ] Tag filter changes Overview, Chats, Sources, Gap Opportunities consistently
- [ ] Deleting a tag detaches it without deleting prompts
- [ ] Tag names are case-insensitive unique per user

---

## 21. MODULE 21 — Shareable Report Export

**Purpose:** a clean, one-page-per-section summary a marketer can hand to a client or manager. **Source:** ZeroRank "Reports" (Visibility Report with monthly trend, prompt performance, Share + Download PDF), CrowdReply reporting, Ayzeo white-label PDFs.
**Depends on:** Modules 9–15.

### 21.1 Approach: print-styled HTML page (zero dependency, free)
Create a server-rendered route `/dashboard/[brandId]/report?from&to` that reuses the **same** `analytics.ts` functions (so report numbers can never differ from the dashboard). Style it with `@media print` and let the browser's **Print → Save as PDF** produce the file. A "Download PDF" button simply calls `window.print()`.

```css
@media print {
  .no-print { display: none !important; }
  body { background: #fff; color: #000; }
  .page-break { break-after: page; }
  table, .card { break-inside: avoid; }
}
```

### 21.2 Report sections
1. **Header** — brand, site, date range, generated-at, "Data: N answers, M prompts, K platforms"
2. **KPI row** — Visibility %, Avg. Rank, Positive-sentiment %
3. **Monthly trend table** — month · visibility · sentiment · avg rank (empty months render "—")
4. **Prompt performance** — top 20 prompts with change vs previous period
5. **Competitor comparison** (Module 19)
6. **Top cited sources** (Module 13)
7. **Gap opportunities — top 5** (Module 15)
8. **Open recommendations** (Module 14) with their evidence
9. **Methodology & limitations footer** — *mandatory for honesty:* how visibility is computed, which platforms were real vs simulated, that LLM answers are non-deterministic, sample size.

### 21.3 Shareable link (optional)
`reports` table (defined in Section 4): public route `/r/[token]` renders a **read-only snapshot**. Store the snapshot **data** (JSON) at creation, not live queries, so a shared report never changes after being sent. Tokens: `crypto.randomBytes(24).toString("base64url")`. Allow revoke (delete row).

### 21.4 Optional CSV export
`GET /api/brands/[id]/export.csv?table=chats|ranking|sources` → `text/csv`. Escape quotes, prefix cells starting with `= + - @` with `'` to prevent CSV/formula injection when opened in Excel.

### 21.5 Acceptance criteria
- [ ] Report KPIs equal the dashboard KPIs for the same range
- [ ] Prints cleanly to PDF with no cut-off tables or nav bars
- [ ] Footer states real-vs-simulated counts
- [ ] Shared link keeps showing the same numbers after new runs

---

## 22. MODULE 22 — Alerts & Scheduled Tracking

**Purpose:** notify the user when something important changes, and run tracking automatically. **Source:** CrowdReply "Alerts"; ZeroRank "updated daily".
**Depends on:** Modules 5, 9–11.

### 22.1 Scheduled tracking (free)
Use `node-cron` inside a long-lived Node process:

```bash
npm i node-cron
```
```typescript
// src/lib/scheduler.ts
import cron from "node-cron";

declare global { var __echorankCron: boolean | undefined }

export function startScheduler() {
  if (globalThis.__echorankCron) return;          // prevent duplicates on hot reload
  globalThis.__echorankCron = true;
  cron.schedule("0 6 * * *", async () => {        // daily 06:00 server time
    const brandsToRun = sqlite.prepare(`SELECT id FROM brands WHERE owner_brand_id IS NULL AND auto_track = 1`).all() as any[];
    for (const b of brandsToRun) {
      try { await runTracking(b.id, "scheduled"); } catch (e) { console.error("scheduled run failed", b.id, e); }
    }
  });
}
```
Start it from `instrumentation.ts` (Next.js) — `export async function register(){ if (process.env.NEXT_RUNTIME === "nodejs") (await import("./lib/scheduler")).startScheduler(); }`. (`auto_track` and `track_frequency` are already defined on `brands` in Section 4.)

> **Deployment reality:** cron needs a process that stays alive. Vercel's serverless functions don't. Free options: run on your own machine/lab server for the demo, a free Render/Railway/Fly instance, or use **GitHub Actions** (free) with a scheduled workflow that calls a protected `POST /api/cron/track` endpoint using a shared secret header. Document whichever you choose.

### 22.2 Alert rules (`alert_rules`)

| Type | Fires when | Default threshold |
|---|---|---|
| `visibility_drop` | latest-run visibility < previous run − threshold pts | 10 |
| `competitor_gain` | any rival's visibility rose ≥ threshold pts and now exceeds yours | 10 |
| `negative_sentiment` | negative share of your mentions > threshold % | 25 |
| `lost_prompt` | a prompt you appeared in on the previous run has 0 mentions now | — |

```typescript
export async function evaluateAlerts(brandId: string, runId: string) {
  const rules = db.select().from(alertRules).where(and(eq(alertRules.brandId, brandId), eq(alertRules.enabled, true))).all();
  const trend = visibilityByRun({ brandId }) as any[];
  const [prev, cur] = [trend.at(-2), trend.at(-1)];
  for (const r of rules) {
    if (r.type === "visibility_drop" && prev && cur && prev.visibility - cur.visibility >= r.threshold) {
      createAlert(brandId, r.id, `Visibility dropped from ${prev.visibility}% to ${cur.visibility}% since the last run.`);
    }
    // ...other rule types
  }
}
```
**Minimum-data guard:** don't alert on runs with fewer than ~10 answers — LLM noise will trigger false alarms and users will mute everything.

### 22.3 Delivery
1. **In-app (default, free, no signup):** bell icon with unread count; list page; mark-read.
2. **Email (optional):** Resend free tier — `POST https://api.resend.com/emails` with `Authorization: Bearer $RESEND_API_KEY` (3,000 emails/month free; requires a verified sender domain or their test sender).
3. **Webhook (optional, trivial):** user-supplied URL (e.g. a Slack/Discord incoming webhook) — `fetch(url, {method:"POST", body: JSON.stringify({text})})`. Run the URL through `safeFetch` (Module 17) to avoid SSRF.

### 22.4 Acceptance criteria
- [ ] A synthetic 10-point drop creates exactly **one** alert (no duplicates on re-evaluation)
- [ ] Scheduler does not start twice under hot reload
- [ ] Alerts need ≥ min sample size
- [ ] Cron endpoint rejects requests without the secret

---

## 23. MODULE 23 — `llms.txt` / `robots.txt` Generator

**Purpose:** generate the files that tell AI crawlers what your site is and what they may access. **Source:** ZeroRank free tools; Ayzeo actionable-optimization pitch.
**Depends on:** Module 2.

### 23.1 What these files are (state precisely, don't overclaim)
- **`robots.txt`** — a long-established crawler-access standard. AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended…) publish whether they honour it.
- **`llms.txt`** — a *proposed*, community convention: a Markdown file at `/llms.txt` summarising your site for LLMs. **Adoption by major AI providers is not guaranteed or verified** — present it as a low-cost, low-risk addition, not a proven ranking lever. Saying this plainly makes your report more credible, not less.

### 23.2 Generator inputs (form)
Site name · one-line description · key pages (title + URL + one-line summary, add-rows) · contact/about URL · per-bot allow/deny checkboxes.

### 23.3 Output templates

`llms.txt`:
```typescript
export const buildLlmsTxt = (i: { name: string; summary: string; pages: { title: string; url: string; note: string }[] }) =>
`# ${i.name}

> ${i.summary}

## Key pages
${i.pages.map(p => `- [${p.title}](${p.url}): ${p.note}`).join("\n")}
`;
```

`robots.txt`:
```typescript
export const buildRobots = (sitemapUrl: string, allow: Record<string, boolean>) =>
  Object.entries(allow).map(([bot, ok]) => `User-agent: ${bot}\n${ok ? "Allow: /" : "Disallow: /"}\n`).join("\n")
  + `\nUser-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
```
Bots list to offer: `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`.

### 23.4 UI
Live preview pane, **Copy** and **Download** buttons, and a note: *"Upload to your site root (`/llms.txt`, `/robots.txt`). Then re-run the Crawlability Checker (Module 17) to verify."* — this connects Module 23 → 17 as a fix-and-verify loop.

### 23.5 Acceptance criteria
- [ ] Generated `robots.txt` passes Module 17's parser as valid
- [ ] Blocking a bot in the UI produces a `Disallow: /` group for exactly that bot
- [ ] UI text does not claim llms.txt guarantees citations

---

## 24. MODULE 24 — Free Public Visibility Checker (no-login demo page)

**Purpose:** a public page where anyone enters a brand + one question and instantly sees whether AI mentions them. Great live-demo moment and lead-gen idea. **Source:** ZeroRank's free "AI Brand Visibility Report".
**Depends on:** Modules 4, 5, 6, 7.

### 24.1 The danger: it spends *your* free-tier quota
Anyone on the internet can now trigger your Groq/Gemini calls. Without protection, one script drains your daily quota in minutes and breaks your demo. Protect it:

1. **Per-IP rate limit** using the `public_check_log` table:
```typescript
export function allowPublicCheck(ip: string, max = 5, windowMin = 60) {
  const since = new Date(Date.now() - windowMin * 60_000).toISOString();
  const n = sqlite.prepare("SELECT COUNT(*) c FROM public_check_log WHERE ip=? AND created_at>=?").get(ip, since) as any;
  if (n.c >= max) return false;
  sqlite.prepare("INSERT INTO public_check_log (id, ip) VALUES (?, ?)").run(randomUUID(), ip);
  return true;
}
```
   Get the IP from `x-forwarded-for` (first value) with a fallback.
2. **Global daily cap** (e.g. 200 checks/day) — a single counter row; return a friendly "demo limit reached, try tomorrow".
3. **Input limits** — brand ≤ 60 chars, question ≤ 200 chars; reject URLs/HTML in inputs.
4. **Cache** identical (brand, question) results for 24 h (table `public_check_cache`, Section 4) — repeated demo clicks cost nothing.
5. **Simple honeypot/CAPTCHA-free bot check:** a hidden form field that must stay empty + a minimum 2 s form-render-to-submit time.

### 24.2 Flow
`POST /api/public/check {brand, question}` → rate-limit → call **one** real provider (not all) a few times (e.g. 3 samples to show variability: *"mentioned in 2 of 3 answers"*) → `detectBrands` + `scoreSentiment` + `extractCitations` → return `{mentionedCount, samples, positions, sentiment, topSources, rivalsSeen}`. **Competitors are auto-discovered** here: since the user supplied none, extract capitalised product-like names from the answers and show them as "other names AI mentioned".

### 24.3 UI
Single centered card: two inputs, **Check**, animated result (e.g. *"Mentioned in 2/3 answers · avg position #2 · tone: positive"*), the answers collapsed beneath, and a CTA "Track this continuously → Sign up". **Always display the sample size** and the line *"AI answers vary — this is a small sample."*

### 24.4 Acceptance criteria
- [ ] 6th request from one IP within an hour returns 429
- [ ] Cached repeat does not call any provider
- [ ] Works logged-out; no stored personal data beyond IP + timestamp (state this in a privacy line)
- [ ] Never calls simulated providers silently — if no key is configured, show "demo mode: simulated" prominently

---

## 25. MODULE 25 — Multi-Country / Locale Tracking (approximate)

**Purpose:** see whether AI answers differ by region. **Source:** ZeroRank's per-prompt Location column.
**Depends on:** Modules 3, 4.

### 25.1 Be honest about what is and isn't possible
- Google AI Overviews / AI Mode localise through Google's real regional search infrastructure.
- Groq/Gemini **chat APIs have no native "answer as if in country X" parameter.** What you *can* do is add a locale instruction to the prompt, which is a **soft nudge**, not true geo-retrieval.
- Therefore: implement locale as a **tracked dimension** with a prompt-level hint, and **label the feature "locale-hinted (approximate)"** in the UI and report. Overclaiming here is the easiest way to lose credibility in a viva.

### 25.2 Implementation
- `prompts.locale` already exists (`'global'` default). Offer a country picker (ISO-3166 list) per prompt.
- In the provider call (Module 4, Section 8.7): `const text = locale === "global" ? prompt : \`The user is located in ${countryName}. Answer for that market, mentioning locally relevant options. ${prompt}\`;`
- Store the locale on the chat row (`chats.locale`, already in Section 4) so the filter works even if the prompt's locale is later edited — **chats are immutable facts**.
- `Scope` gains `locale?: string`; every chart can then compare **IN vs US vs global**.
- UI: a locale selector in the global filter bar + a small flag/ISO chip on each prompt row (matches ZeroRank's Location column).

### 25.3 A cheap, genuine experiment for your report
Run the same 10 prompts with `locale = global, US, IN, DE`. Report how often the **set of brands named** changes (Jaccard similarity of brand sets between locales). Even a "mostly the same" result is a valid, honest finding about LLM locale sensitivity.

### 25.4 Acceptance criteria
- [ ] Changing a prompt's locale never rewrites historical chats
- [ ] Locale filter changes all charts consistently
- [ ] UI labels the feature as approximate

---

## 26. MODULE 26 — MCP Server & REST API Access (technical differentiator)

**Purpose:** let external tools (Claude Desktop, Cursor, Claude Code, any MCP client) read and manage your EchoRank data. **Source:** ZeroRank's "MCP Access" developer tab. Strong technical signal for an M.Tech evaluation because it shows tool-calling / protocol literacy, not just CRUD.
**Depends on:** all data modules. **Everything here is free and open source.**

### 26.1 API keys (auth for non-browser clients)
```typescript
// create: show the plaintext key ONCE, store only a hash
import { randomBytes, createHash } from "crypto";
const key = "er_" + randomBytes(24).toString("base64url");
const keyHash = createHash("sha256").update(key).digest("hex");
db.insert(apiKeys).values({ id: randomUUID(), userId, keyHash, label }).run();
// verify: hash the incoming Bearer token and look it up; update last_used_at
```
UI: **Settings → API keys** — create, label, revoke; copy-once modal. Middleware `requireApiKeyOrSession()` accepts either a session cookie or `Authorization: Bearer er_...`. Rate-limit per key.

### 26.2 REST surface (versioned: `/api/v1/...`)
```
GET  /api/v1/brands
GET  /api/v1/brands/:id/overview
GET  /api/v1/brands/:id/prompts            POST (create)
POST /api/v1/brands/:id/track              (async, returns runId)
GET  /api/v1/runs/:id                      (status/progress)
GET  /api/v1/brands/:id/chats?...          GET /sources   GET /gaps   GET /recommendations
```
Return JSON with a stable shape; document it in a short `API.md` (or an OpenAPI file) — that doc is itself a deliverable.

### 26.3 MCP server
Use the official SDK and the **Streamable HTTP** transport so remote clients can connect with one URL.

```bash
npm i @modelcontextprotocol/sdk zod
```
```typescript
// src/app/api/mcp/route.ts  (conceptual skeleton — check the SDK docs for the exact current API)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function buildServer(userId: string) {
  const server = new McpServer({ name: "echorank", version: "1.0.0" });

  server.tool("list_brands", "List the user's tracked brands", {}, async () => ({
    content: [{ type: "text", text: JSON.stringify(listBrands(userId)) }],
  }));

  server.tool("get_overview", "Visibility, sentiment, share of voice for a brand",
    { brandId: z.string(), from: z.string().optional(), to: z.string().optional() },
    async ({ brandId, from, to }) => {
      assertOwned(brandId, userId);
      return { content: [{ type: "text", text: JSON.stringify(overview({ brandId, from, to })) }] };
    });

  server.tool("add_prompt", "Add a tracked prompt", { brandId: z.string(), text: z.string().max(300) },
    async ({ brandId, text }) => { assertOwned(brandId, userId); /* insert */ return { content: [{ type: "text", text: "ok" }] }; });

  server.tool("run_tracking", "Start a tracking run (uses the monthly answer allowance)", { brandId: z.string() },
    async ({ brandId }) => { assertOwned(brandId, userId); const { runId } = startRunAsync(brandId); return { content: [{ type: "text", text: `started ${runId}` }] }; });

  server.tool("get_gap_opportunities", "Prompts where competitors appear and you don't", { brandId: z.string() },
    async ({ brandId }) => { assertOwned(brandId, userId); return { content: [{ type: "text", text: JSON.stringify(gapOpportunities({ brandId })) }] }; });

  server.tool("get_recommendations", "Open prioritised recommendations with evidence", { brandId: z.string() }, /* ... */);
  return server;
}
```
Authenticate each MCP request with the API key (Bearer) → resolve `userId` → build the server **per request** scoped to that user, so a key can never reach another user's brands. **Never expose raw SQL or a "run any query" tool.**

### 26.4 Safety rules for the MCP surface
- Every tool re-checks ownership (`assertOwned`) — don't rely on the client passing valid ids.
- `run_tracking` is the only expensive tool: enforce a per-key daily cap.
- Mutating tools (`add_prompt`, `run_tracking`) are explicit; there is **no** delete tool in v1.
- Treat all text returned from chats as **untrusted data** — raw AI answers can contain prompt-injection text; return them as data and keep tool descriptions free of instructions derived from stored content.

### 26.5 Dev docs page
Replicate ZeroRank's developer tab: a **MCP** page showing copy-paste connect snippets —
Claude Code: `claude mcp add --transport http echorank https://YOUR_HOST/api/mcp --header "Authorization: Bearer er_..."`
Claude Desktop: Settings → Connectors → custom connector → URL. Cursor: `.cursor/mcp.json` with `{ "mcpServers": { "echorank": { "url": "...", "headers": { "Authorization": "Bearer er_..." } } } }`.
> **Verify these against the current MCP/client docs when you build** — client config syntax evolves quickly; do not trust a doc snapshot (including this one) for exact flags.

### 26.6 Acceptance criteria
- [ ] Revoked key → 401 immediately
- [ ] Key A cannot read User B's brand through any tool
- [ ] An MCP client can: list brands → add prompt → run tracking → read overview, end to end
- [ ] Plain-text key shown once and never retrievable again

---

## 27. Research Experiment 1 — In-Context Citation Replication (your "proof of work")

**Why this exists:** the product proves *you can build a tracker*. This experiment proves *something about the world* — and gives you real charts for the viva within days, not months. It is a small-scale replication of the design in Aşkın & Baykara (2026), run on the free models you already have.

### 27.1 Hypothesis
*Among sources containing the same facts, the form of the text (FAQ-structured vs plain prose vs statistics-dense) changes how often an LLM chooses to cite it.* The published result (GPT-4o): FAQ 83.4%, plain 81.1%, statistics-dense 59.3%. **Your goal is not to match it — it is to measure honestly and discuss agreement or disagreement.**

### 27.2 Design
- **Topics:** 5 (e.g. project-management software, VPNs, running shoes, email marketing, password managers).
- **Versions per topic (same facts, different form, ~200–250 words each):** `plain`, `faq` (3–4 Q&A pairs), `stats` (≥4 percentages/figures), optionally `academic`, `citation-rich`.
  Generate them with your free LLM, then **verify with Module 8's `extractFeatures`** that each version really differs on the intended feature (question count for faq; numericRatio for stats) — this is the "manipulation check" and it is cheap.
- **Query:** 6–10 informational questions per topic.
- **Trial:** show the model all versions as numbered sources in **randomised order** (shuffle every repetition to cancel position bias), ask it to answer and cite as `[Source N]`, parse which sources it cited.
- **Repetitions:** 15–20 per query. Total e.g. 5 topics × 8 queries × 15 reps = 600 trials per model. At ~27 requests/min this is ~25 minutes per model on a free tier — feasible.

```typescript
const prompt = (q: string, srcs: string[]) =>
`Answer the question using the sources below. Cite the sources you actually use as [Source N].
Question: ${q}

${srcs.map((s, i) => `[Source ${i + 1}]\n${s}`).join("\n\n")}`;

// per trial: shuffle versions -> remember mapping index->version -> parse /\[Source (\d+)\]/g -> credit versions
```

### 27.3 Analysis (do this honestly)
- Citation rate per version = cited trials ÷ trials, with a **95% Wilson confidence interval**.
- **Chi-square goodness-of-fit** across versions (is the distribution non-uniform?). With ~600 trials, differences of ~10 points are usually detectable; smaller are not — say so.
- Report **per model** (Groq-Llama vs Gemini) — do not pool; model differences are a finding.
- Report the position effect (citation rate by presented position) to show your shuffle worked.
- Compare to the paper's numbers in a table. Disagreement is fine: different model (the paper used GPT-4o), different N, in-context rather than real retrieval — exactly the limitations that paper itself lists.

```typescript
export function wilson(k: number, n: number, z = 1.96) {
  const p = k / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const m = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);
  return { rate: p, lo: (c - m) / d, hi: (c + m) / d };
}
```

### 27.4 Integrity rules (what a committee actually checks)
1. **Pre-register** the design (write the plan in your repo before running).
2. **Never discard or re-run** trials to get a nicer chart. Report every trial; report failures (rate-limit errors) as excluded with a count.
3. Fix the random seed and log model name + date (model snapshots change).
4. State limitations: free models, in-context not live web retrieval, English only, one query style.

### 27.5 Deliverables
Bar chart (rate ± CI per version, per model) · table vs the published numbers · 1-page discussion · raw CSV of every trial in the repo.

---

## 28. Research Experiment 2 — Before/After Case Study

**Why:** shows the *whole product loop* produces a measurable change, with honest causal language.

### 28.1 Protocol
1. Pick **one real small site** you control (your portfolio/project site, a club site, an open-source project's docs).
2. Define 12–15 prompts a real user would ask about that site's topic. Add 2–3 real competitors.
3. **Baseline:** run tracking **≥ 5 times over several days** (variance estimate matters more than one number). Record visibility mean ± SD.
4. Run Module 17 (crawl audit) and Module 8 (content score) on the site. Apply **2–3 recommended fixes** (e.g. add FAQ + JSON-LD, unblock a bot in robots.txt, publish one comparison page).
5. **Wait for recrawl** (days to weeks — for live-retrieval platforms; static-knowledge models will not change at all).
6. **Post:** run tracking ≥ 5 times again. Compare.

### 28.2 Reporting honestly
- Report the delta **with the baseline variance**. If the change is smaller than the run-to-run noise, say *"no detectable change"* — that is a legitimate, publishable result.
- Free chat APIs (Groq/Gemini without search) **do not retrieve your live page**, so they may never reflect your new content. Be explicit: in this setup the before/after is limited to platforms with live retrieval, or to the in-context method of Section 27. If you can only show non-retrieval models, present the case study as a **demonstration of the measurement pipeline** and the Crawlability/Content-score improvements (which *are* directly measurable), not as proof of visibility lift.
- Use causal wording carefully: *"followed by"*, *"associated with"* — never *"caused"*.

---

## 29. Build Order (phases, each ends with something demoable)

| Phase | Modules | You can demo |
|---|---|---|
| **P0 Foundation** | 0, 1, 2, 3 | Sign up → add brand + competitors + prompts |
| **P1 Core loop** | 4, 5, 6, 7 | Click Run → real (or simulated) answers stored with mention/rank/sentiment/citations |
| **P2 Insight** | 9, 10, 11, 12, 13 | Dashboard charts, Chats log with highlights, Sources table |
| **P3 Diagnosis** | 14, 15, 19, 20 | Evidence-backed recommendations, Gap Opportunities, Ranking table, Tags |
| **P4 Action tools** | 8, 17, 18, 23 | Content score, crawl audit, brief generator, llms.txt generator |
| **P5 Discovery & automation** | 16, 21, 22 | Discovery feed, shareable report, scheduled runs + alerts |
| **P6 Public & developer surface** | 24, 25, 26 | Public checker page, locale tracking, MCP server |
| **P7 Research & evidence** | 27, 28 | Experiment charts, case study, final report |

**Rule:** never start a phase until the previous phase's acceptance criteria are all ticked. A half-finished P4 on top of a flaky P1 is how projects die.

**Suggested weekly rhythm (adjust freely, no hard deadline):** P0–P1 first (everything depends on the core loop), then run the Section 27 experiment **early** because it generates data while you build the rest.

---

## 30. Explicitly Out of Scope (say this in your report)

| Feature | Seen in | Why excluded |
|---|---|---|
| Query Fan-out analytics (true sub-query traces) | ZeroRank, Otterly | Platforms do not expose real traces; a simulated decomposition is possible later but would be an approximation |
| Auto-posting via managed/shadow accounts | CrowdReply | Violates Reddit/Quora terms; astroturfing |
| Paid backlinks marketplace | CrowdReply | Google link-scheme territory; paid |
| Google Analytics "AI Traffic" integration | ZeroRank | Requires OAuth + Google API review; tangential to core |
| Billing, SSO, white-label, multi-workspace/agency seats | ZeroRank, Otterly | Infrastructure-heavy, not part of the research contribution |
| 17+ real platforms incl. Google AI Overviews / AI Mode | ZeroRank | No public API for several; needs paid SERP scraping |
| ChatGPT/Claude/Perplexity **real** API tracking | all | Paid keys; architecture supports adding them via the `AIProvider` interface |

---

## 31. Testing Strategy

- **Unit tests (Vitest, free):** `detectBrands`, `scoreSentiment`, `extractCitations`, `extractFeatures`, `gapOpportunities`, `wilson`, SSRF `isPrivate`. These are pure functions — cheap, high value.
- **Fixtures:** keep ~30 real/synthetic AI answers in `/fixtures` with hand-labelled expected results (mentioned? position? sentiment? domains?). The same set doubles as your **evaluation data** for the sentiment-agreement table (Module 6).
- **Rule tests (Module 14):** insert synthetic `chats` rows → assert exactly which recommendations fire.
- **Integration smoke test:** script that signs up, creates a brand + prompt, runs tracking with only mock providers, and asserts the overview numbers.
- **Security checks:** cross-user access attempts return 404; SSRF targets rejected; CSV injection escaped; rate limits enforced.

```bash
npm i -D vitest
# package.json: "test": "vitest run"
```

---

## 32. Deployment (free)

| Option | Fits | Caveat |
|---|---|---|
| **Run locally / lab machine** | The demo + viva | Needs your laptop; simplest and fully free |
| **Render / Railway / Fly.io free tiers** | Long-lived Node process → cron + background runs work | Free tiers may sleep or change terms; SQLite file needs a persistent disk (or use the platform's free Postgres and swap the Drizzle driver) |
| **Vercel free tier** | Static + short API routes | Serverless: **no durable background work**, SQLite file is ephemeral. Use only if you move to hosted Postgres (Neon/Supabase free) and chunk runs per request |

Recommendation: demo locally and keep a hosted copy as a bonus. Always include `README` setup steps that work from a clean clone: `npm install → cp .env.example .env → npm run dev`.

---

## 33. Risks & Honest Limitations (copy into your report)

1. **Non-determinism:** the same prompt yields different answers; every metric is an estimate with sampling error. Always show *n*.
2. **Free-tier models ≠ ChatGPT/Perplexity/Google:** your "platforms" are Llama (Groq) and Gemini; simulated rows are demonstrations only and are excluded from headline metrics.
3. **No live retrieval in plain chat APIs:** content changes on a website will not appear in their answers, which limits what a before/after can show (Section 28).
4. **Keyword sentiment is crude:** report its measured agreement with hand labels.
5. **Citation extraction depends on the model writing domains** (no structured citations from plain chat APIs).
6. **Locale tracking is a prompt-level approximation** (Module 25).
7. **Brand-name ambiguity** ("Notion", "Linear") causes false positives; aliases/context checks reduce but don't eliminate it.
8. **Literature is young and conflicting** (e.g. statistics help in Aggarwal et al., hurt in Aşkın & Baykara's setup). Frame all rules as *associated with*, not *proven to cause*.
9. **Third-party API policy risk:** Reddit/Groq/Gemini terms, limits and model names change; keep adapters isolated and model names in config.

---

## Appendix A — Quick-start prompt for a brand-new chat

Paste the following, then attach this file:

> *"I'm building EchoRank, a free-tier AI-search-visibility platform (GEO/AEO tracker). The attached MASTER_BUILD_PLAN.md is the full spec and starts from an empty folder. Work strictly in the phase order of Section 29. Start with P0 (Modules 0–3): scaffold the project, create the SQLite schema exactly as in Section 4, then implement Modules 1–3 with their acceptance criteria. After each module, show me how to verify each acceptance checkbox and wait for my confirmation before moving on. Use only free tools. If the spec and reality conflict (e.g. a model name or API changed), tell me and propose a fix rather than silently deviating."*

## Appendix B — Free resources & signup links

| Need | Where | Notes |
|---|---|---|
| Groq API key | console.groq.com/keys | Free tier; model names change — check their models page |
| Gemini API key | aistudio.google.com/apikey | Free tier; limits vary by model/region |
| Reddit app | reddit.com/prefs/apps | May require approval under current policy; HN/StackExchange are fallbacks |
| Hacker News search | hn.algolia.com/api | No key |
| Stack Exchange API | api.stackexchange.com | No key at low volume |
| Resend email | resend.com | 3,000 emails/month free (optional) |
| MCP SDK & docs | modelcontextprotocol.io | Verify exact API against current docs |

## Appendix C — Glossary

- **GEO / AEO** — optimising content so generative/answer engines mention and cite it.
- **RAG** — retrieval-augmented generation: fetch documents, then generate an answer grounded in them.
- **Visibility %** — share of tracked answers that mention your brand.
- **Share of voice** — a brand's visibility relative to competitors across the same answers.
- **Gap opportunity** — a prompt where rivals are named and you are not.
- **Simulated row** — a mock-provider answer; never counted as real measurement.
- **MCP** — Model Context Protocol; a standard for exposing tools/data to AI clients.

## Appendix D — Master module checklist (tick as you go)

- [ ] 0 Setup · [ ] 1 Auth · [ ] 2 Brands/Competitors · [ ] 3 Prompts · [ ] 4 AI Querying
- [ ] 5 Mentions/Rank + Orchestrator · [ ] 6 Sentiment · [ ] 7 Citations · [ ] 8 Content Score
- [ ] 9 Visibility Trend · [ ] 10 Sentiment Chart · [ ] 11 Share of Voice · [ ] 12 Chats Log · [ ] 13 Sources
- [ ] 14 Recommendations · [ ] 15 Gap Opportunities · [ ] 16 Discovery Feed · [ ] 17 Crawlability Checker
- [ ] 18 Content Briefs · [ ] 19 Ranking Page · [ ] 20 Tags · [ ] 21 Reports · [ ] 22 Alerts + Scheduler
- [ ] 23 llms.txt/robots.txt · [ ] 24 Public Checker · [ ] 25 Locale Tracking · [ ] 26 MCP/API
- [ ] 27 Experiment 1 · [ ] 28 Case study · [ ] Final report

*— End of document —*
